import { IBounded, ICartesian2 } from "../../geometry";

export enum VectorTileGeomType {
    UNKNOWN = 0,
    POINT = 1,
    LINESTRING = 2,
    POLYGON = 3,
}

export interface IVectorTileFeature extends IBounded {
    id?: number | undefined;
    type: VectorTileGeomType;
    properties: { [name: string]: any } | null;
    loadGeometry(): Array<Array<ICartesian2>>;
}

export interface IVectorTileLayer {
    // A layer MUST contain a version field with the major version number of the Vector Tile specification to which the layer adheres
    version: number;
    // A layer MUST contain a name field. A Vector Tile MUST NOT contain two or more layers whose name values are byte-for-byte identical
    name: string;
    // A layer MUST contain an extent that describes the width and height of the tile in integer coordinates.
    extent: number;

    length: number;
    // A layer SHOULD contain at least one feature.
    feature(i: number): IVectorTileFeature | undefined;
}

// A Vector Tile consists of a set of named layers.
// A layer contains geometric features and their metadata.
export interface IVectorTileContent {
    layers: Record<string, IVectorTileLayer>;
}
