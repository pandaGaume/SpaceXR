import type { IContent, ITile, ITileset } from "@spacexr/3d-tiles-core";

import type { IMetadataDocumentContext, IRuntimeFeatureMetadata } from "../metadata/types";
import type { IImplicitCoordinates } from "../implicit/types";
import type { IRuntimeResourceCost } from "./cache";
import type { Tile3D } from "../pipeline/tile-3d";
import type { MetadataHandle, TileContentKind, TileReadinessState } from "../pipeline/states";

export type RuntimeContentStatus = TileReadinessState;
export type RuntimeContentKind = TileContentKind;

export interface IRuntimeTilesetDocument {
    id: string;
    uri: string;
    baseUri: string;
    tileset: ITileset;
    metadata: IMetadataDocumentContext;
}

export interface IRuntimeContent<TContentHandle> {
    id: string;
    descriptor: IContent;
    uri: string;
    status: RuntimeContentStatus;
    kind: RuntimeContentKind;
    attempts: number;
    handle?: TContentHandle;
    featureMetadata?: readonly IRuntimeFeatureMetadata[];
    cacheKey?: string;
    cost?: IRuntimeResourceCost;
    error?: unknown;
    attached: boolean;
    lastTouchedFrame: number;
    readyFrame: number;
    metadataHandle: MetadataHandle;
    featureMetadataHandle: MetadataHandle;
    readonly ready: boolean;
}

export type IRuntimeTile<TSpatial, TContentHandle, TGlyphHandle> = Tile3D<TSpatial, TContentHandle, TGlyphHandle>;

export interface ITileContext<TSpatial> {
    runtimeId: string;
    tileId: string;
    depth: number;
    tile: ITile;
    document: IRuntimeTilesetDocument;
    spatial: TSpatial;
    implicitCoordinates?: IImplicitCoordinates;
}

/** A selected tile displayed next to a tile two or more levels coarser, despite the quadtree balance. */
export interface IRuntimeQuadtreeImbalance<TSpatial, TContentHandle, TGlyphHandle> {
    /** The finer tile. */
    tile: IRuntimeTile<TSpatial, TContentHandle, TGlyphHandle>;
    /** Level of detail of its coarsest edge neighbour, in the quadtree pyramid. */
    coarseLod: number;
}

export interface IRuntimeFrameResult<TSpatial, TContentHandle, TGlyphHandle> {
    frame: number;
    selected: readonly IRuntimeTile<TSpatial, TContentHandle, TGlyphHandle>[];
    requested: readonly IRuntimeContent<TContentHandle>[];
    pendingLoads: number;
    /**
     * Edges the quadtree balance could not keep within one level this frame, because neither the coarse neighbour's
     * children nor an ancestor of the fine tile were ready. Empty without `quadtreeBalance`.
     */
    unbalanced: readonly IRuntimeQuadtreeImbalance<TSpatial, TContentHandle, TGlyphHandle>[];
}
