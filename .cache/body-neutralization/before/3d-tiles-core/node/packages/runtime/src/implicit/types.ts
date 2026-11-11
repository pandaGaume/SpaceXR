import type { IBoundingVolume, IContent, IImplicitTiling, IMetadataEntity, IMetadataSchema, ISubtree, ITile } from "@spacexr/3d-tiles-core";

import type { TileReadinessState } from "../pipeline/states";
import type { ITileAddress } from "./tile-data-source";

export interface IImplicitCoordinates {
    level: number;
    x: number;
    y: number;
    z?: number;
}

export interface ILoadedImplicitSubtree {
    subtree: ISubtree;
    /** Buffer payloads indexed exactly like subtree.buffers. */
    buffers?: readonly Uint8Array[];
}

export interface IImplicitSubtreeLoadRequest {
    uri: string;
    documentUri: string;
    coordinates: IImplicitCoordinates;
    implicitTiling: IImplicitTiling;
    contentCount: number;
    signal: AbortSignal;
}

export interface IImplicitSubtreeLoader {
    load(request: IImplicitSubtreeLoadRequest): Promise<ILoadedImplicitSubtree>;
}

export interface IImplicitTileResolveContext {
    documentUri: string;
    rootTile: ITile;
    implicitTiling: IImplicitTiling;
    coordinates: IImplicitCoordinates;
    computedBoundingVolume: IBoundingVolume;
    computedGeometricError: number;
    computedContents: readonly IContent[];
}

export interface IImplicitTileOverride {
    boundingVolume?: IBoundingVolume;
    geometricError?: number;
    contents?: readonly IContent[];
    metadata?: IMetadataEntity;
    /** Heights of the terrain of the tile when they are known before its content, prepared by its parent for example. */
    heightRange?: readonly [number, number];
}

export interface IImplicitTileAddressContext {
    documentUri: string;
    rootTile: ITile;
    implicitTiling: IImplicitTiling;
    coordinates: IImplicitCoordinates;
}

/**
 * Optional runtime override for sources whose physical pyramid differs from
 * the regular 3D Tiles subdivision, for example XYZ Web Mercator services.
 */
export interface IImplicitTileResolver {
    resolve(context: IImplicitTileResolveContext): IImplicitTileOverride | undefined;
    /**
     * Address of an implicit tile in a pyramid shared by several implicit
     * tilesets, in the XYZ convention. Quadtree balancing uses it to find
     * neighbours across implicit roots; without it, neighbours are searched
     * within each implicit tileset only.
     */
    addressOf?(context: IImplicitTileAddressContext): ITileAddress | undefined;
    /**
     * Implicit subtree registered at an implicit tile, whose rules apply from
     * that tile down; `undefined` keeps the rules of the tileset. Called for
     * each tile the tileset makes available, before the tile is created.
     */
    subtreeAt?(context: IImplicitTileAddressContext): IImplicitSubtreeGraft | undefined;
}

/**
 * An implicit subtree registered at a tile of an implicit tileset, with its own rules.
 *
 * From the registered tile down, the subtree replaces the rules of the tileset: its implicit tiling, hence its own
 * levels and availability, its content templates, its resolver and its subtree loader. Its root tile takes the place
 * of the registered tile, contents included. A subtree may stop the refinement early, make tiles unavailable, supply
 * other contents, or go deeper than the tileset. Subtrees may register subtrees of their own.
 */
export interface IImplicitSubtreeGraft {
    /** Root tile of the subtree: an implicit root tile, with `implicitTiling` and the content templates of the subtree. */
    tile: ITile;
    /** Resolves the tiles of the subtree, and the subtrees registered inside it. Defaults to the resolver of the tileset. */
    resolver?: IImplicitTileResolver;
    /** Loads the availability subtrees of the subtree. Defaults to the subtree loader of the adapter. */
    subtrees?: IImplicitSubtreeLoader;
}

export interface IImplicitMetadataDecodeRequest {
    loaded: ILoadedImplicitSubtree;
    availability: ISubtreeAvailability;
    schema?: IMetadataSchema;
    implicitTiling: IImplicitTiling;
    coordinates: IImplicitCoordinates;
    localCoordinates: IImplicitCoordinates;
    contentCount: number;
}

export interface IImplicitMetadataDecodeResult {
    tileMetadata?: IMetadataEntity;
    contentMetadata?: readonly (IMetadataEntity | undefined)[];
}

/** Decodes binary property tables after a standard subtree has been loaded. */
export interface IImplicitMetadataDecoder {
    decode(request: IImplicitMetadataDecodeRequest): IImplicitMetadataDecodeResult;
}

export type ImplicitSubtreeStatus = TileReadinessState;

export interface IRuntimeImplicitContext {
    id: string;
    rootTile: ITile;
    implicitTiling: IImplicitTiling;
    contentTemplates: readonly IContent[];
    /** Resolver of a registered subtree, in place of the resolver of the adapter. */
    resolver?: IImplicitTileResolver;
    /** Subtree loader of a registered subtree, in place of the loader of the adapter. */
    subtrees?: IImplicitSubtreeLoader;
}

export interface IRuntimeImplicitSubtree {
    uri: string;
    coordinates: IImplicitCoordinates;
    status: ImplicitSubtreeStatus;
    attempts: number;
    loaded?: ILoadedImplicitSubtree;
    availability?: ISubtreeAvailability;
    error?: unknown;
    estimatedBytes: number;
    lastTouchedFrame: number;
}

export interface IRuntimeImplicitTile {
    context: IRuntimeImplicitContext;
    coordinates: IImplicitCoordinates;
    localCoordinates: IImplicitCoordinates;
    subtree: IRuntimeImplicitSubtree;
    childrenMaterialized: boolean;
    metadataApplied: boolean;
    /** Heights given by the resolver the last time it resolved the tile. */
    heightRange?: readonly [number, number];
}

export interface ISubtreeAvailability {
    isTileAvailable(coordinates: IImplicitCoordinates): boolean;
    isContentAvailable(contentIndex: number, coordinates: IImplicitCoordinates): boolean;
    isChildSubtreeAvailable(coordinates: IImplicitCoordinates): boolean;
}
