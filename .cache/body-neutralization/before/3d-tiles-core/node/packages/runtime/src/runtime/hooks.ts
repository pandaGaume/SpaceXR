import type { ContentLoadResult, ILoadedTileset } from "../ports";
import type { ILoadedImplicitSubtree, IRuntimeImplicitSubtree } from "../implicit/types";
import type { IMetadataSnapshot } from "../metadata/types";
import type { IRuntimeContent, IRuntimeFrameResult, IRuntimeTile, IRuntimeTilesetDocument } from "./contracts";
import type { IRuntimeCacheEviction } from "./cache";

export type HookResult = void | Promise<void>;

export interface ITilesetLoadHookContext {
    runtimeId: string;
    uri: string;
    parentDocumentUri?: string;
}

export interface ITilesetLoadedHookContext extends ITilesetLoadHookContext {
    loaded: ILoadedTileset;
    document?: IRuntimeTilesetDocument;
}

export interface IFrameHookContext<TCamera, TSpatial, TContentHandle, TGlyphHandle> {
    runtimeId: string;
    frame: number;
    camera: TCamera;
    result?: IRuntimeFrameResult<TSpatial, TContentHandle, TGlyphHandle>;
}

export interface ITileHookContext<TSpatial, TContentHandle, TGlyphHandle> {
    runtimeId: string;
    tile: IRuntimeTile<TSpatial, TContentHandle, TGlyphHandle>;
}

export interface IContentHookContext<TSpatial, TContentHandle, TGlyphHandle> extends ITileHookContext<
    TSpatial,
    TContentHandle,
    TGlyphHandle
> {
    content: IRuntimeContent<TContentHandle>;
    result?: ContentLoadResult<TContentHandle>;
    metadata?: IMetadataSnapshot;
}

export interface ISubtreeHookContext<TSpatial, TContentHandle, TGlyphHandle> extends ITileHookContext<
    TSpatial,
    TContentHandle,
    TGlyphHandle
> {
    subtree: IRuntimeImplicitSubtree;
    loaded?: ILoadedImplicitSubtree;
}

export interface IMetadataHookContext<TSpatial, TContentHandle, TGlyphHandle> extends ITileHookContext<
    TSpatial,
    TContentHandle,
    TGlyphHandle
> {
    snapshot: IMetadataSnapshot;
}

export interface IRuntimeErrorHookContext<TSpatial, TContentHandle, TGlyphHandle> {
    runtimeId: string;
    phase: string;
    error: unknown;
    tile?: IRuntimeTile<TSpatial, TContentHandle, TGlyphHandle>;
    content?: IRuntimeContent<TContentHandle>;
}

export interface ICacheEvictionHookContext<TSpatial, TContentHandle, TGlyphHandle> {
    runtimeId: string;
    eviction: IRuntimeCacheEviction;
    tile: IRuntimeTile<TSpatial, TContentHandle, TGlyphHandle>;
    content?: IRuntimeContent<TContentHandle>;
    subtree?: IRuntimeImplicitSubtree;
}

export interface IRuntimeHooks<TCamera, TSpatial, TContentHandle, TGlyphHandle> {
    beforeTilesetLoad?(context: ITilesetLoadHookContext): HookResult;
    afterTilesetLoad?(context: ITilesetLoadedHookContext): HookResult;
    beforeFrame?(context: IFrameHookContext<TCamera, TSpatial, TContentHandle, TGlyphHandle>): HookResult;
    afterFrame?(context: IFrameHookContext<TCamera, TSpatial, TContentHandle, TGlyphHandle>): HookResult;
    beforeContentLoad?(context: IContentHookContext<TSpatial, TContentHandle, TGlyphHandle>): HookResult;
    afterContentLoad?(context: IContentHookContext<TSpatial, TContentHandle, TGlyphHandle>): HookResult;
    beforeSubtreeLoad?(context: ISubtreeHookContext<TSpatial, TContentHandle, TGlyphHandle>): HookResult;
    afterSubtreeLoad?(context: ISubtreeHookContext<TSpatial, TContentHandle, TGlyphHandle>): HookResult;
    beforeContentAttach?(context: IContentHookContext<TSpatial, TContentHandle, TGlyphHandle>): HookResult;
    afterContentAttach?(context: IContentHookContext<TSpatial, TContentHandle, TGlyphHandle>): HookResult;
    beforeContentDetach?(context: IContentHookContext<TSpatial, TContentHandle, TGlyphHandle>): HookResult;
    afterContentDetach?(context: IContentHookContext<TSpatial, TContentHandle, TGlyphHandle>): HookResult;
    beforeMetadataResolve?(context: ITileHookContext<TSpatial, TContentHandle, TGlyphHandle>): HookResult;
    afterMetadataResolve?(context: IMetadataHookContext<TSpatial, TContentHandle, TGlyphHandle>): HookResult;
    beforeGlyphPublish?(context: ITileHookContext<TSpatial, TContentHandle, TGlyphHandle>): HookResult;
    afterGlyphPublish?(context: ITileHookContext<TSpatial, TContentHandle, TGlyphHandle>): HookResult;
    beforeGlyphRevoke?(context: ITileHookContext<TSpatial, TContentHandle, TGlyphHandle>): HookResult;
    afterGlyphRevoke?(context: ITileHookContext<TSpatial, TContentHandle, TGlyphHandle>): HookResult;
    onTileSelected?(context: ITileHookContext<TSpatial, TContentHandle, TGlyphHandle>): HookResult;
    onTileDeselected?(context: ITileHookContext<TSpatial, TContentHandle, TGlyphHandle>): HookResult;
    beforeCacheEviction?(context: ICacheEvictionHookContext<TSpatial, TContentHandle, TGlyphHandle>): HookResult;
    afterCacheEviction?(context: ICacheEvictionHookContext<TSpatial, TContentHandle, TGlyphHandle>): HookResult;
    onError?(context: IRuntimeErrorHookContext<TSpatial, TContentHandle, TGlyphHandle>): HookResult;
}
