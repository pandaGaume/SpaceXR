import { IGeoShape } from "dev/core/src/geography";
import { IDrawableTileMapLayer, IShapeLayer, ITileMapLayerOptions } from "../map/tiles.map.interfaces";
import { ITile, ITileMetrics } from "../tiles.interfaces";

import { TileMapLayer } from "../map";
import { ShapeProvider } from "./tiles.geography.shape.provider";
import { IShape } from "../../geometry/shapes/geometry.shapes.interfaces";
import { EPSG3857 } from "./tiles.geography.EPSG3857";
import { PolylineSimplifier } from "../../geometry/geometry.simplify";

export type ShapeLayerContentType = Array<IShape>;

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

    /// <summary>
    /// A number specifying the line width, in coordinate space units.
    /// Zero, negative, Infinity, and NaN values are ignored.
    /// This value is 1.0 by default.
    /// </summary>
    weight?: number;
}

export interface IShapeLayerOptions extends IShapeDrawOptions, ITileMapLayerOptions {
    metrics?: ITileMetrics;
    tolerance?: number;
    highestQuality?: boolean;
}

export class ShapeLayer extends TileMapLayer<ShapeLayerContentType> implements IShapeLayer, IDrawableTileMapLayer<ShapeLayerContentType> {
    protected _dashArray?: Array<number>;
    protected _color?: string;
    protected _weight?: number;

    public constructor(name: string, options?: IShapeLayerOptions, provider?: ShapeProvider, enabled?: boolean) {
        if (provider === undefined) {
            const metrics = options?.metrics ?? EPSG3857.Shared;
            if (options?.highestQuality !== undefined || options?.tolerance !== undefined) {
                provider = new ShapeProvider(name, metrics, new PolylineSimplifier(options.tolerance, options.highestQuality));
            } else {
                provider = new ShapeProvider(name, metrics);
            }
        }
        super(name, provider, options, enabled);
        this._dashArray = options?.dashArray;
        this._color = options?.color;
        this._weight = options?.weight;
    }

    public addShapes(...shapes: Array<IGeoShape>): void {
        const provider = this.provider as ShapeProvider;
        provider.addShapes(...shapes);
    }

    public draw(context: CanvasRenderingContext2D, tile: ITile<ShapeLayerContentType>): void {
        console.log("Drawing shapes");
    }
}
