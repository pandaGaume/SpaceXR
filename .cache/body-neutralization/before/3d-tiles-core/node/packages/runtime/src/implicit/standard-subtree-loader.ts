import { SubtreeCodec } from "@spacexr/3d-tiles-core";

import { StandardUriResolver } from "../ports/resource";
import type { IRuntimeUriResolver } from "../ports/resource";
import type { IImplicitSubtreeLoader, IImplicitSubtreeLoadRequest, ILoadedImplicitSubtree } from "./types";

export interface IByteResourceLoadRequest {
    uri: string;
    signal: AbortSignal;
}

export interface IByteResourceLoader {
    load(request: IByteResourceLoadRequest): Promise<Uint8Array>;
}

export type FetchFunction = (input: string, init?: RequestInit) => Promise<Response>;

export class FetchByteResourceLoader implements IByteResourceLoader {
    public constructor(private readonly fetcher: FetchFunction = globalThis.fetch.bind(globalThis)) {}

    public async load(request: IByteResourceLoadRequest): Promise<Uint8Array> {
        const response = await this.fetcher(request.uri, { signal: request.signal });
        if (!response.ok) throw new Error(`Resource request failed with HTTP ${response.status} for ${request.uri}.`);
        return new Uint8Array(await response.arrayBuffer());
    }
}

export interface IStandardImplicitSubtreeLoaderOptions {
    resources: IByteResourceLoader;
    uri?: IRuntimeUriResolver;
}

/** Loads standard JSON and binary subtree files, including external buffers. */
export class StandardImplicitSubtreeLoader implements IImplicitSubtreeLoader {
    private readonly resources: IByteResourceLoader;
    private readonly uri: IRuntimeUriResolver;
    private readonly codec = new SubtreeCodec();

    public constructor(options: IStandardImplicitSubtreeLoaderOptions) {
        this.resources = options.resources;
        this.uri = options.uri ?? new StandardUriResolver();
    }

    public async load(request: IImplicitSubtreeLoadRequest): Promise<ILoadedImplicitSubtree> {
        const bytes = await this.resources.load({ uri: request.uri, signal: request.signal });
        const decoded = this.codec.decode(bytes);
        const declarations = decoded.subtree.buffers ?? [];
        if (declarations.length === 0) return { subtree: decoded.subtree };

        const baseUri = this.uri.baseOf(request.uri);
        const buffers = await Promise.all(
            declarations.map(async (buffer, index) => {
                let payload: Uint8Array;
                if (buffer.uri) {
                    payload = await this.resources.load({ uri: this.uri.resolve(buffer.uri, baseUri), signal: request.signal });
                } else if (index === 0 && decoded.binaryChunk) {
                    payload = decoded.binaryChunk;
                } else {
                    throw new Error(`Subtree buffer ${index} has no URI and no internal binary chunk.`);
                }
                if (payload.byteLength < buffer.byteLength) {
                    throw new Error(
                        `Subtree buffer ${index} declares ${buffer.byteLength} bytes but only ${payload.byteLength} were loaded.`,
                    );
                }
                return payload.subarray(0, buffer.byteLength);
            }),
        );
        return { subtree: decoded.subtree, buffers };
    }
}
