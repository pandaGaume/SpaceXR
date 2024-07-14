import { IDrawableTileMapLayer } from "../map/tiles.map.interfaces";

import { TileMapLayer } from "../map";
import { VectorTileProvider } from "./tiles.vector.provider";
import { isLine, isPolygon, isPolyline } from "../../geometry/shapes/geometry.shapes.interfaces";
import { EPSG3857 } from "../geography/tiles.geography.EPSG3857";
import { PolylineSimplifier } from "../../geometry/geometry.simplify";
import { ICanvasRenderingContext } from "../../engine";
import { ICartesian3 } from "../../geometry";
import { IVectorTileDrawOptions, IVectorLayer, IVectorTileContent, IVectorLayerOptions, IVectorTileLayer, IVectorTileFeature } from "./tiles.vector.interfaces";

export class VectorLayer extends TileMapLayer<IVectorTileContent> implements IVectorLayer, IDrawableTileMapLayer, IVectorTileDrawOptions {
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

    public constructor(name: string, options?: IVectorLayerOptions, provider?: VectorTileProvider, enabled?: boolean) {
        if (provider === undefined) {
            const metrics = options?.metrics ?? EPSG3857.Shared;
            if (options?.highestQuality !== undefined || options?.tolerance !== undefined) {
                provider = new VectorTileProvider(name, metrics, new PolylineSimplifier(options.tolerance, options.highestQuality));
            } else {
                provider = new VectorTileProvider(name, metrics);
            }
        }
        super(name, provider, options, enabled);
        this._dashArray = options?.dashArray;
        this._color = options?.color;
        this._opacity = options?.opacity ?? VectorLayer.DefaultOpacity;
        this._weight = options?.weight;
        this._stroke = options?.stroke === undefined ? true : options.stroke;
        this._fill = options?.fill === undefined ? true : options.fill;
        this._fillColor = options?.fillColor;
        this._fillOpacity = options?.fillOpacity ?? VectorLayer.DefaultOpacity;
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

    public draw(ctx: ICanvasRenderingContext): void {
        /*        if (tile.content) {
            for (const [key, layer] of tile.content) {
                this._drawLayer(ctx, 0, 0, key, layer);
                continue;
            }
        }*/
    }

    protected _getOptions(layer: string): IVectorTileDrawOptions {
        return this;
    }

    protected _drawLayer(ctx: ICanvasRenderingContext, x: number, y: number, key: string, layer: IVectorTileLayer): void {
        const drawOptions = this._getOptions(key);
        for (const feature of layer.features ?? []) {
            this._drawFeature(ctx, x, y, feature, drawOptions);
        }
    }

    protected _drawFeature(ctx: ICanvasRenderingContext, x: number, y: number, feature: IVectorTileFeature, drawOptions?: IVectorTileDrawOptions): void {
        if (!feature.shape) {
            return;
        }
        const shape = feature.shape;

        if (isLine(shape)) {
            this._drawPolyline(ctx, x, y, [shape.start, shape.end], drawOptions);
            return;
        }

        if (isPolyline(shape)) {
            this._drawPolyline(ctx, x, y, shape.points, drawOptions);
            return;
        }

        if (isPolygon(shape)) {
            this._drawPolygon(ctx, x, y, shape.points, drawOptions);
            return;
        }
    }

    protected _drawPolyline(ctx: ICanvasRenderingContext, x: number, y: number, points: Array<ICartesian3>, options?: IVectorTileDrawOptions, close: boolean = false): void {
        const o = options ?? this;
        if (o.dashArray) {
            ctx.setLineDash(o.dashArray);
        }
        ctx.strokeStyle = o.color ?? VectorLayer.DefaultStrokeStyle;
        ctx.lineWidth = o.weight ?? VectorLayer.DefaultWeight;
        this._drawPath(ctx, x, y, points, close);
        ctx.stroke();
    }

    protected _drawPolygon(ctx: ICanvasRenderingContext, x: number, y: number, points: Array<ICartesian3>, options?: IVectorTileDrawOptions): void {
        const o = options ?? this;
        if (o.fill) {
            ctx.fillStyle = o.fillColor ?? VectorLayer.DefaultFillStyle;
            ctx.globalAlpha = o.fillOpacity ?? VectorLayer.DefaultOpacity;
            this._drawPath(ctx, x, y, points, true);
            ctx.fill();
        }
        if (o.stroke) {
            if (o.dashArray) {
                ctx.setLineDash(o.dashArray);
            }
            ctx.strokeStyle = o.color ?? VectorLayer.DefaultStrokeStyle;
            ctx.globalAlpha = o.opacity ?? VectorLayer.DefaultOpacity;
            ctx.lineWidth = o.weight ?? VectorLayer.DefaultWeight;
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
