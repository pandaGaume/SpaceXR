import { IShape, ISize2 } from "core/geometry";
import { ITile } from "core/tiles";

export enum VectorTileGeomType {
    UNKNOWN = 0,
    POINT = 1,
    LINESTRING = 2,
    POLYGON = 3,
}

export interface IVectorTileFeature {
    id?: number;
    tags: Array<number>;
    shape: IShape;
}

export interface IVectorTileLayer {
    // A layer MUST contain a version field with the major version number of the Vector Tile specification to which the layer adheres
    version: number;
    // A layer MUST contain a name field. A Vector Tile MUST NOT contain two or more layers whose name values are byte-for-byte identical
    name: string;
    // A layer SHOULD contain at least one feature.
    features?: Array<IVectorTileFeature>;
    // Each feature in a layer may have one or more key-value pairs as its metadata
    metadata?: Map<string, any>;
    // A layer MUST contain an extent that describes the width and height of the tile in integer coordinates.
    extent: ISize2;
}

// A Vector Tile consists of a set of named layers.
// A layer contains geometric features and their metadata.
export interface IVectorTileContent {
    // A Vector Tile SHOULD contain at least one layer.
    layers?: Map<string, IVectorTileLayer>;
}

export interface IVectorTile extends ITile<IVectorTileContent> {}
