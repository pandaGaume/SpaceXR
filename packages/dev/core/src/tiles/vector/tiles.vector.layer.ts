import { IGeoShape } from "dev/core/src/geography";
import { IDrawableTileMapLayer, ITileMapLayerOptions, TileMapLayerDrawFn } from "../map/tiles.map.interfaces";
import { ITile, ITileMetrics } from "../tiles.interfaces";

import { TileMapLayer } from "../map";
import { ShapeProvider } from "./tiles.vector.provider";
import { IShape, isLine, isPolygon, isPolyline } from "../../geometry/shapes/geometry.shapes.interfaces";
import { EPSG3857 } from "../geography/tiles.geography.EPSG3857";
import { PolylineSimplifier } from "../../geometry/geometry.simplify";
import { ICanvasRenderingContext } from "../../engine";
import { ICartesian3 } from "../../geometry";
import { Nullable } from "../../types";
import { IDecoratedShape, isDecoratedShape, IShapeDrawOptions, IShapeLayer, ShapeLayerOutputContentType, ShapeViewCoordinateMode } from "./tiles.vector.interfaces";

export type ShapeLayerContentType = Array<ShapeLayerOutputContentType>;
export type ShapeLayerInputContentType = IGeoShape | IDecoratedShape<IGeoShape> | IShape | IDecoratedShape<IShape>;

export interface IShapeLayerOptions extends IShapeDrawOptions, ITileMapLayerOptions {
    metrics?: ITileMetrics;
    tolerance?: number;
    highestQuality?: boolean;
}

export class ShapeLayer extends TileMapLayer<ShapeLayerContentType> implements IShapeLayer, IDrawableTileMapLayer<ShapeLayerContentType> {
    public static DefaultStrokeStyle = "red";
    public static DefaultFillStyle = "grey";
    public static DefaultOpacity = 1;
    public static DefaultWeight = 1;

    protected _dashArray?: Array<number>;
    protected _color?: string;
    protected _weight?: number;
    protected _stroke?: boolean;
    protected _opacity?: number;
    protected _fill?: boolean;
    protected _fillColor?: string;
    protected _fillOpacity?: number;
    protected _debug?: TileMapLayerDrawFn<ShapeLayerContentType>;

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
        this._opacity = options?.opacity ?? ShapeLayer.DefaultOpacity;
        this._weight = options?.weight;
        this._stroke = options?.stroke === undefined ? true : options.stroke;
        this._fill = options?.fill === undefined ? true : options.fill;
        this._fillColor = options?.fillColor;
        this._fillOpacity = options?.fillOpacity ?? ShapeLayer.DefaultOpacity;
    }

    public get debug(): TileMapLayerDrawFn<ShapeLayerContentType> | undefined {
        return this._debug;
    }

    public set debug(value: TileMapLayerDrawFn<ShapeLayerContentType> | undefined) {
        this._debug = value;
    }

    public get dashArray(): Array<number> | undefined {
        return this._dashArray;
    }

    public get color(): string | undefined {
        return this._color;
    }
    public get weight(): number | undefined {
        return this._weight;
    }
    public get stroke(): boolean | undefined {
        return this._stroke;
    }
    public get opacity(): number | undefined {
        return this._opacity;
    }
    public get fill(): boolean | undefined {
        return this._fill;
    }
    public get fillColor(): string | undefined {
        return this._fillColor;
    }
    public get fillOpacity(): number | undefined {
        return this._fillOpacity;
    }

    public draw(ctx: ICanvasRenderingContext, x: number, y: number, tile: ITile<Array<ShapeLayerOutputContentType>>): void {
        if (tile.content) {
            for (const content of tile.content) {
                if (isDecoratedShape<ShapeLayerOutputContentType>(content)) {
                    if (content.coordinateMode === ShapeViewCoordinateMode.World) {
                        this._draw(ctx, x, y, content.value, content.options);
                        continue;
                    }
                    this._draw(ctx, 0, 0, content.value, content.options);
                    continue;
                }
                if (content.coordinateMode === ShapeViewCoordinateMode.World) {
                    this._draw(ctx, x, y, content.value, null);
                    continue;
                }
                this._draw(ctx, 0, 0, content.value, null);
                continue;
            }
        }
    }

    public addShapes(...shapes: Array<ShapeLayerInputContentType>): void {
        const provider = this.provider as ShapeProvider;
        provider.addShapes(...shapes);
    }

    protected _draw(ctx: ICanvasRenderingContext, x: number, y: number, shape: IShape, options: Nullable<IShapeDrawOptions>): void {
        if (isLine(shape)) {
            this._drawPolyline(ctx, x, y, [shape.start, shape.end], options);
            return;
        }

        if (isPolyline(shape)) {
            this._drawPolyline(ctx, x, y, shape.points, options);
            return;
        }

        if (isPolygon(shape)) {
            this._drawPolygon(ctx, x, y, shape.points, options);
            return;
        }
    }

    protected _drawPolyline(ctx: ICanvasRenderingContext, x: number, y: number, points: Array<ICartesian3>, options: Nullable<IShapeDrawOptions>, close: boolean = false): void {
        const o = options ?? this;
        if (o.dashArray) {
            ctx.setLineDash(o.dashArray);
        }
        ctx.strokeStyle = o.color ?? ShapeLayer.DefaultStrokeStyle;
        ctx.lineWidth = o.weight ?? ShapeLayer.DefaultWeight;
        this._drawPath(ctx, x, y, points, close);
        ctx.stroke();
    }

    protected _drawPolygon(ctx: ICanvasRenderingContext, x: number, y: number, points: Array<ICartesian3>, options: Nullable<IShapeDrawOptions>): void {
        const o = options ?? this;
        if (o.fill) {
            ctx.fillStyle = o.fillColor ?? ShapeLayer.DefaultFillStyle;
            ctx.globalAlpha = o.fillOpacity ?? ShapeLayer.DefaultOpacity;
            this._drawPath(ctx, x, y, points, true);
            ctx.fill();
        }
        if (o.stroke) {
            if (o.dashArray) {
                ctx.setLineDash(o.dashArray);
            }
            ctx.strokeStyle = o.color ?? ShapeLayer.DefaultStrokeStyle;
            ctx.globalAlpha = o.opacity ?? ShapeLayer.DefaultOpacity;
            ctx.lineWidth = o.weight ?? ShapeLayer.DefaultWeight;
            // draw the path if not previously done
            if (!this._fill) {
                this._drawPath(ctx, x, y, points, true);
            }
            ctx.stroke();
        }
    }

    protected _drawPath(ctx: ICanvasRenderingContext, x: number, y: number, points: Array<ICartesian3>, close: boolean = false): void {
        ctx.beginPath();
        let p = points[0];
        let px = p.x - x;
        let py = p.y - y;
        ctx.moveTo(px, py);
        for (let i = 0; i != points.length; ++i) {
            p = points[i];
            px = p.x - x;
            py = p.y - y;
            ctx.lineTo(px, py);
        }
        if (close) {
            p = points[0];
            px = p.x - x;
            py = p.y - y;
            ctx.lineTo(px, py);
        }
    }
}
