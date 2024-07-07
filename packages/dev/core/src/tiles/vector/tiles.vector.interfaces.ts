import { IGeoBounded, IGeoShape } from "../../geography";
import { IBounded, IShape } from "../../geometry";
import { Nullable } from "../../types";
import { IDrawableTileMapLayer, ITileMapLayer } from "../map";

export enum ShapeViewCoordinateMode {
    Local,
    World,
}

export interface IShapeView extends IDecoratedShape<IShape>, IGeoBounded, IBounded {
    source: Nullable<IGeoShape | IShape>;
    lod: number;
    coordinateMode: ShapeViewCoordinateMode;
}

export type ShapeLayerOutputContentType = IShapeView; //IShape | IDecoratedShape<IShape>;

export interface IShapeLayer extends ITileMapLayer<Array<ShapeLayerOutputContentType>>, IDrawableTileMapLayer<Array<ShapeLayerOutputContentType>> {}

export interface IShapeDrawOptions {
    /// <summary>
    /// A boolean value that specifies whether to draw the shape stroke.
    /// Set it to false to disable border on polygons or circles.
    /// </summary>
    stroke: boolean;

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

export interface IDecoratedShape<T> {
    value: T;
    options: Nullable<IShapeDrawOptions>;
}

export function isDecoratedShape<T>(b: any): b is IDecoratedShape<T> {
    if (typeof b !== "object" || b === null) return false;
    return b.value !== undefined && b.options !== undefined;
}
