import { isValidTileAddress, type ITileAddress } from "../addressing/tile-address";
import { TileHttpClient, type ITileHttpClientOptions, type TileFetchResult } from "../sources/tile-http-client";
import { expandTileUrlTemplate, validateTileUrlTemplate } from "../sources/url-template";
import { CubeTileSurface } from "./cube-tile-surface";
import { ReferenceSurface } from "./reference-surface";

/** Scheme of the datasets of this version of the specification. */
export const CELESTIAL_CUBE_SCHEME = "spacexr-cube-equiangular/1";

/** A tile below which levels down to its own `maxLOD` are available, such as the polar caps of the Moon. */
export interface ICelestialDatasetSubtree {
    readonly face: number;
    readonly lod: number;
    readonly x: number;
    readonly y: number;
    readonly maxLOD: number;
}

/** Descriptor of a dataset of a tile service; see `docs/celestial-tiling.md`. */
export interface ICelestialDataset {
    /** This specification and its version: {@link CELESTIAL_CUBE_SCHEME}. */
    readonly scheme: string;
    /** Catalogue name of the body. */
    readonly body: string;
    /** Body-fixed frame and its version. */
    readonly frame: string;
    /** Radii `a`, `b`, `c` of the reference surface, in metres. */
    readonly referenceRadii: readonly [number, number, number];
    readonly content: "elevation" | "imagery";
    /** Tile format, such as `terrarium` for radial heights or `png`, `jpeg`, `webp` for imagery. */
    readonly encoding: string;
    /** Cells per tile side: tiles hold `tileSize + 1` samples per side. */
    readonly tileSize: number;
    /** Levels available everywhere, from `minLOD` to `maxLOD`. */
    readonly minLOD: number;
    readonly maxLOD: number;
    readonly subtrees: readonly ICelestialDatasetSubtree[];
    /** URL template. */
    readonly tiles: string;
}

function fail(message: string): never {
    throw new RangeError(`Invalid celestial dataset: ${message}`);
}

function text(value: Record<string, unknown>, name: string): string {
    const member = value[name];
    if (typeof member !== "string" || member.length === 0) fail(`${name} must be a non-empty string.`);
    return member;
}

function level(value: Record<string, unknown>, name: string): number {
    const member = value[name];
    if (!Number.isInteger(member) || (member as number) < 0 || (member as number) > 52) fail(`${name} must be a level from 0 to 52.`);
    return member as number;
}

/**
 * Checks the JSON value of a dataset descriptor.
 *
 * @returns The descriptor, with an empty `subtrees` when it has none.
 * @throws RangeError When a member is missing or invalid, naming it. A scheme of another version is rejected.
 * @throws TileUrlTemplateError When the URL template uses an unknown variable.
 */
export function parseCelestialDataset(value: unknown): ICelestialDataset {
    if (typeof value !== "object" || value === null || Array.isArray(value)) fail("the descriptor must be an object.");
    const source = value as Record<string, unknown>;
    const scheme = text(source, "scheme");
    if (scheme !== CELESTIAL_CUBE_SCHEME) fail(`scheme ${scheme} is not supported, expected ${CELESTIAL_CUBE_SCHEME}.`);
    const radii = source.referenceRadii;
    if (!Array.isArray(radii) || radii.length !== 3 || radii.some((radius) => typeof radius !== "number" || !Number.isFinite(radius) || radius <= 0)) {
        fail("referenceRadii must be three positive numbers of metres.");
    }
    const content = source.content;
    if (content !== "elevation" && content !== "imagery") fail("content must be elevation or imagery.");
    const tileSize = source.tileSize;
    if (!Number.isInteger(tileSize) || (tileSize as number) < 1) fail("tileSize must be a positive integer.");
    const minLOD = level(source, "minLOD");
    const maxLOD = level(source, "maxLOD");
    if (minLOD > maxLOD) fail("minLOD must not exceed maxLOD.");
    const rawSubtrees = source.subtrees ?? [];
    if (!Array.isArray(rawSubtrees)) fail("subtrees must be an array.");
    const subtrees = rawSubtrees.map((raw: unknown): ICelestialDatasetSubtree => {
        if (typeof raw !== "object" || raw === null) fail("each subtree must be an object.");
        const subtree = raw as Record<string, unknown>;
        const address = { face: subtree.face as number, lod: subtree.lod as number, x: subtree.x as number, y: subtree.y as number };
        if (subtree.face === undefined || !isValidTileAddress(address)) fail("each subtree needs a valid face, lod, x and y.");
        const subtreeMaxLOD = level(subtree, "maxLOD");
        if (subtreeMaxLOD < address.lod) fail("the maxLOD of a subtree must reach at least its lod.");
        return { face: address.face, lod: address.lod, x: address.x, y: address.y, maxLOD: subtreeMaxLOD };
    });
    const tiles = text(source, "tiles");
    validateTileUrlTemplate(tiles);
    return {
        scheme,
        body: text(source, "body"),
        frame: text(source, "frame"),
        referenceRadii: [radii[0] as number, radii[1] as number, radii[2] as number],
        content,
        encoding: text(source, "encoding"),
        tileSize: tileSize as number,
        minLOD,
        maxLOD,
        subtrees,
        tiles,
    };
}

/** Options of {@link CelestialTileSource}. */
export interface ICelestialTileSourceOptions {
    /** Shared client, or options used to create a dedicated one. */
    client?: TileHttpClient | ITileHttpClientOptions;
}

/**
 * Tiles of a dataset of a tile service, over HTTP. It never requests a tile outside the declared availability, which
 * resolves as absent, so that a sparse pyramid costs no failed request.
 */
export class CelestialTileSource {
    public readonly dataset: ICelestialDataset;
    /** Surface of the tiles of the dataset, on its reference surface. */
    public readonly surface: CubeTileSurface;
    /** Deepest level available anywhere. */
    public readonly deepestLOD: number;
    public readonly client: TileHttpClient;
    /** Deepest level of the subtree rooted at each tile. */
    private readonly subtreeDepths = new Map<string, number>();

    /** @param dataset - The descriptor, or its JSON value, checked by {@link parseCelestialDataset}. */
    public constructor(dataset: ICelestialDataset | unknown, options: ICelestialTileSourceOptions = {}) {
        this.dataset = parseCelestialDataset(dataset);
        const [a, b, c] = this.dataset.referenceRadii;
        this.surface = new CubeTileSurface(new ReferenceSurface(a, b, c));
        this.deepestLOD = this.dataset.subtrees.reduce((deepest, subtree) => Math.max(deepest, subtree.maxLOD), this.dataset.maxLOD);
        this.client = options.client instanceof TileHttpClient ? options.client : new TileHttpClient(options.client);
        for (const { face, lod, x, y, maxLOD } of this.dataset.subtrees) {
            const root = `${face}/${lod}/${x}/${y}`;
            this.subtreeDepths.set(root, Math.max(maxLOD, this.subtreeDepths.get(root) ?? 0));
        }
    }

    /**
     * Deepest level of the dataset at the place of a tile, at most the level of the tile: the level of the tile itself
     * where the dataset declares it, of its deepest declared ancestor elsewhere.
     */
    public servingLevel(address: ITileAddress): number {
        const everywhere = Math.min(address.lod, this.dataset.maxLOD);
        if (address.lod <= this.dataset.maxLOD || this.subtreeDepths.size === 0) return everywhere;
        const face = address.face ?? 0;
        let best = everywhere;
        for (let lod = Math.min(address.lod, this.deepestLOD); lod >= 0; lod--) {
            const shift = address.lod - lod;
            const depth = this.subtreeDepths.get(`${face}/${lod}/${Math.floor(address.x / 2 ** shift)}/${Math.floor(address.y / 2 ** shift)}`);
            if (depth !== undefined) best = Math.max(best, Math.min(depth, address.lod));
            if (best === address.lod) break;
        }
        return best;
    }

    /** Whether the dataset declares a tile. */
    public isAvailable(address: ITileAddress): boolean {
        if (!isValidTileAddress(address)) return false;
        if (address.lod < this.dataset.minLOD) return false;
        return this.servingLevel(address) === address.lod;
    }

    /** Returns the URL of a tile, whether it is available or not. */
    public urlOf(address: ITileAddress): string {
        return expandTileUrlTemplate(this.dataset.tiles, address);
    }

    /**
     * Fetches a tile; a tile outside the declared availability resolves as absent, like a 404, without any request.
     *
     * @throws RangeError When the address is invalid.
     */
    public async fetchTile(address: ITileAddress, signal?: AbortSignal): Promise<TileFetchResult> {
        const url = this.urlOf(address);
        if (!this.isAvailable(address)) return { status: "absent", url, httpStatus: 404 };
        return this.client.fetchTile(url, signal);
    }
}
