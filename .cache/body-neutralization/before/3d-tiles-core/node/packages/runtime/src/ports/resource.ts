import type { IMetadataSchema, ITileset } from "@spacexr/3d-tiles-core";

export interface ITilesetLoadRequest {
    uri: string;
    parentDocumentUri?: string;
    signal: AbortSignal;
}

export interface ILoadedTileset {
    tileset: ITileset;
    /** Base used to resolve references declared by this document. */
    baseUri?: string;
}

export interface ITilesetLoader {
    load(request: ITilesetLoadRequest): Promise<ILoadedTileset>;
}

export interface IMetadataSchemaLoadRequest {
    uri: string;
    documentUri: string;
    signal: AbortSignal;
}

export interface IMetadataSchemaLoader {
    load(request: IMetadataSchemaLoadRequest): Promise<IMetadataSchema>;
}

/** Resolves canonical resource identities, without injecting renderer state. */
export interface IRuntimeUriResolver {
    resolve(reference: string, baseUri: string): string;
    baseOf(uri: string): string;
}

export class StandardUriResolver implements IRuntimeUriResolver {
    public resolve(reference: string, baseUri: string): string {
        try {
            return new URL(reference, baseUri).toString();
        } catch {
            if (!baseUri) return reference;
            const separator = baseUri.endsWith("/") ? "" : "/";
            return `${baseUri}${separator}${reference}`;
        }
    }

    public baseOf(uri: string): string {
        try {
            return new URL(".", uri).toString();
        } catch {
            const index = Math.max(uri.lastIndexOf("/"), uri.lastIndexOf("\\"));
            return index >= 0 ? uri.slice(0, index + 1) : "";
        }
    }
}
