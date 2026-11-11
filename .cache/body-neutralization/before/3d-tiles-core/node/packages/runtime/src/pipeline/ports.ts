import type { ContentLoadResult } from "../ports/content";
import type { IRuntimeContent } from "../runtime/contracts";
import type { Tile3D } from "./tile-3d";
import type { IMetadataStore } from "./metadata-store";
import type { MetadataHandle } from "./states";

export interface ITileReadinessPort<TRenderHandle> {
    readonly tileId: string;
    readonly activationId: number;
    readonly signal: AbortSignal;
    ready(contentId: string, result: ContentLoadResult<TRenderHandle>): Promise<boolean>;
    failed(contentId: string, error: unknown): Promise<void>;
    cancelled(contentId: string): Promise<void>;
}

export interface ITileActivationContext<TSpatial, TRenderHandle, TGlyphHandle> {
    runtimeId: string;
    tile: Tile3D<TSpatial, TRenderHandle, TGlyphHandle>;
    pendingContents: readonly IRuntimeContent<TRenderHandle>[];
    priority: number;
    activationId: number;
    signal: AbortSignal;
    readiness: ITileReadinessPort<TRenderHandle>;
}

export interface ITileDeactivationContext<TSpatial, TRenderHandle, TGlyphHandle> {
    runtimeId: string;
    tile: Tile3D<TSpatial, TRenderHandle, TGlyphHandle>;
    activationId: number;
}

export interface ITileActivationAdapter<TSpatial, TRenderHandle, TGlyphHandle = unknown> {
    activate(context: ITileActivationContext<TSpatial, TRenderHandle, TGlyphHandle>): void | Promise<void>;
    deactivate(context: ITileDeactivationContext<TSpatial, TRenderHandle, TGlyphHandle>): void | Promise<void>;
}

export interface ITilePresentationResource<TRenderHandle> {
    content: IRuntimeContent<TRenderHandle>;
    handle: TRenderHandle;
    metadataHandle: MetadataHandle;
}

export interface ITilePresentationContext<TSpatial, TRenderHandle, TGlyphHandle> {
    runtimeId: string;
    tile: Tile3D<TSpatial, TRenderHandle, TGlyphHandle>;
    resources: readonly ITilePresentationResource<TRenderHandle>[];
    tileMetadataHandle: MetadataHandle;
    metadataStore: IMetadataStore;
}

export interface ITilePresentationAdapter<TSpatial, TRenderHandle, TGlyphHandle = unknown> {
    present(context: ITilePresentationContext<TSpatial, TRenderHandle, TGlyphHandle>): void | Promise<void>;
    hide(context: ITilePresentationContext<TSpatial, TRenderHandle, TGlyphHandle>): void | Promise<void>;
    release?(context: ITilePresentationContext<TSpatial, TRenderHandle, TGlyphHandle>): void | Promise<void>;
}
