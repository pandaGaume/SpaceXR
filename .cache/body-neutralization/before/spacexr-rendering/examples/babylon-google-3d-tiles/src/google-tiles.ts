import { TilesetJsonCodec, type ITileset } from "@spacexr/3d-tiles-core";
import type { ILoadedTileset, IRuntimeUriResolver, ITilesetLoader, ITilesetLoadRequest } from "@spacexr/3d-tiles-runtime";

const GOOGLE_TILES_ORIGIN = "https://tile.googleapis.com";
const GOOGLE_3D_TILES_PREFIX = "/v1/3dtiles/";
const GOOGLE_TILES_PROXY_PREFIX = "/google-3d-tiles";
const tilesetCodec = new TilesetJsonCodec();

export interface IFetchedTileset {
    tileset: ITileset;
    documentUri: string;
    baseUri: string;
}

/** Resolves Google 3D Tiles child URIs while preserving their session parameter. */
export class GoogleTilesUriResolver implements IRuntimeUriResolver {
    private session: string | undefined;

    /** Google Photorealistic 3D Tiles root document routed through the host backend. */
    public get rootTilesetUri(): string {
        return `${GOOGLE_TILES_PROXY_PREFIX}${GOOGLE_3D_TILES_PREFIX}root.json`;
    }

    public resolve(reference: string, baseUri: string): string {
        let resolved: string;
        try {
            resolved = new URL(reference, baseUri || `${GOOGLE_TILES_ORIGIN}/`).toString();
        } catch {
            const separator = baseUri.endsWith("/") ? "" : "/";
            resolved = `${baseUri}${separator}${reference}`;
        }
        return this.route(resolved);
    }

    public baseOf(uri: string): string {
        try {
            const url = new URL(uri);
            this.rememberSession(url);
            return new URL(".", url).toString();
        } catch {
            const index = Math.max(uri.lastIndexOf("/"), uri.lastIndexOf("\\"));
            return index >= 0 ? uri.slice(0, index + 1) : "";
        }
    }

    private route(uri: string): string {
        try {
            const url = new URL(uri);
            if (url.pathname.startsWith(GOOGLE_3D_TILES_PREFIX)) {
                this.rememberSession(url);
                if (!url.searchParams.has("session") && this.session) url.searchParams.set("session", this.session);
                return `${GOOGLE_TILES_PROXY_PREFIX}${url.pathname}${url.search}`;
            }
            if (url.pathname.startsWith(`${GOOGLE_TILES_PROXY_PREFIX}${GOOGLE_3D_TILES_PREFIX}`)) {
                this.rememberSession(url);
                if (!url.searchParams.has("session") && this.session) url.searchParams.set("session", this.session);
            }
            return url.toString();
        } catch {
            return uri;
        }
    }

    private rememberSession(url: URL): void {
        const session = url.searchParams.get("session");
        if (session) this.session = session;
    }
}

/** Builds a request error that names the failed resource without exposing the API key added by the proxy. */
export async function googleRequestError(response: Response, requestedUri: string): Promise<Error> {
    const url = new URL(response.url || requestedUri, globalThis.location?.href ?? GOOGLE_TILES_ORIGIN);
    const secret = url.searchParams.get("key");
    const parameterNames = [...url.searchParams.keys()].filter((name) => name !== "key");
    const abbreviatedPath = url.pathname.length > 96 ? `...${url.pathname.slice(-96)}` : url.pathname;
    let detail = "";
    try {
        const payload = (await response.json()) as { error?: { message?: unknown } };
        if (typeof payload.error?.message === "string") detail = ` ${payload.error.message}`;
    } catch {
        // The HTTP status and redacted request URI still provide a useful diagnostic.
    }
    if (secret) detail = detail.replaceAll(secret, "[redacted]");
    const parameters = parameterNames.length > 0 ? parameterNames.join(", ") : "none";
    return new Error(
        `Google 3D tile request failed with HTTP ${response.status}.${detail} Request: ${url.origin}${abbreviatedPath}; parameters: ${parameters}.`,
    );
}

export function decodeTileset(text: string, documentUri: string, resolver: IRuntimeUriResolver): IFetchedTileset {
    return {
        tileset: tilesetCodec.decode(text),
        documentUri,
        baseUri: resolver.baseOf(documentUri),
    };
}

export async function fetchTileset(uri: string, resolver: IRuntimeUriResolver, signal: AbortSignal): Promise<IFetchedTileset> {
    const response = await fetch(uri, {
        signal,
        credentials: "omit",
        headers: { Accept: "application/json" },
    });
    if (!response.ok) throw new Error(`Google 3D Tiles document request failed with HTTP ${response.status}.`);
    const documentUri = response.url || uri;
    return decodeTileset(await response.text(), documentUri, resolver);
}

/** Loads root and external tileset JSON documents. */
export class GoogleTilesetLoader implements ITilesetLoader {
    public constructor(private readonly resolver: IRuntimeUriResolver) {}

    public async load(request: ITilesetLoadRequest): Promise<ILoadedTileset> {
        const fetched = await fetchTileset(request.uri, this.resolver, request.signal);
        return { tileset: fetched.tileset, baseUri: fetched.baseUri };
    }
}
