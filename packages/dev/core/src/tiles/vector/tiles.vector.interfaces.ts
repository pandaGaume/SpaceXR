import { IBounded, ICartesian2 } from "../../geometry";
import { IDrawableTileMapLayer, ITileMapLayer, ITileMapLayerOptions } from "../map";
import { ITile, ITileMetrics } from "../tiles.interfaces";

export interface IVectorTileStyle {
    /// <summary>
    /// A boolean value that specifies whether to draw the shape stroke.
    /// Set it to false to disable border on polygons or circles.
    /// </summary>
    stroke?: boolean;

    /// <summary>
    /// An Array of numbers that specify distances to alternately draw a line and a gap (in coordinate space units).
    /// If the number of elements in the array is odd, the elements of the array get copied and concatenated.
    /// For example, [5, 15, 25] will become [5, 15, 25, 5, 15, 25].
    /// If the array is empty, the line dash list is cleared and line strokes return to being solid.
    /// </summary>
    dashArray?: Array<number>;

    /// <summary>
    /// A string parsed as CSS <color> value.
    /// </summary>
    color?: string;
    opacity?: number;

    /// <summary>
    /// A number specifying the line width, in coordinate space units.
    /// Zero, negative, Infinity, and NaN values are ignored.
    /// This value is 1.0 by default.
    /// </summary>
    weight?: number;

    fill?: boolean;

    fillColor?: string;
    fillOpacity?: number;
}

export enum VectorTileGeomType {
    UNKNOWN = 0,
    POINT = 1,
    LINESTRING = 2,
    POLYGON = 3,
}

export interface IVectorTileFeature extends IBounded {
    id?: number | undefined;
    type: VectorTileGeomType;
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
    feature(i: number): IVectorTileFeature;
}

// A Vector Tile consists of a set of named layers.
// A layer contains geometric features and their metadata.
export interface IVectorTileContent {
    layers: Record<string, IVectorTileLayer>;
}

export interface IVectorTile extends ITile<IVectorTileContent> {}

export interface IVectorLayer extends ITileMapLayer<IVectorTileContent>, IDrawableTileMapLayer {}

export interface IVectorLayerOptions extends ITileMapLayerOptions {
    metrics?: ITileMetrics;
    tolerance?: number;
    highestQuality?: boolean;
    style?: IVectorTileStyle;
    styles?: Map<string, IVectorTileStyle>;
}
