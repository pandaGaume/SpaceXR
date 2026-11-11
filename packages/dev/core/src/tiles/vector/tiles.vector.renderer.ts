import { ICartesian2, PolylineSimplifier } from "../../geometry";
import { IVectorTileContent, IVectorTileFeature, IVectorTileLayer, VectorTileGeomType } from "./tiles.vector.interfaces";
import {
    ExpressionSpecification,
    ICirclePaintStyle,
    IFillPaintStyle,
    ILinePaintStyle,
    IsExpressionSpecification,
    IVectorLayerStyle,
    IVectorStyle,
    LayerStyleTypes,
    PropertyValueSpecification,
} from "./tiles.vector.style.interface";

export class TileVectorRenderer {
    static DefaultOpacity = 1.0;
    static DefaultLineWith = 1.0;
    static DefaultColor = "white";

    _simplifier: PolylineSimplifier<ICartesian2>;
    // cached style and ordered layers
    _style?: IVectorStyle;
    _orderedStyleLayers?: Array<number>;

    public constructor(style?: IVectorStyle, simplifier?: PolylineSimplifier<ICartesian2>) {
        this._style = style;
        this._simplifier = simplifier ?? PolylineSimplifier.Shared;
        this._orderedStyleLayers = this._prepareOrderedLayers(style);
    }

    public renderTile(tile: IVectorTileContent, ctx: CanvasRenderingContext2D, w?: number, h?: number, style?: IVectorStyle): void {
        w = w ?? ctx.canvas.width;
        h = h ?? ctx.canvas.height;

        if (tile) {
            style = style ?? this._style;
            if (style) {
                if (style !== this._style) {
                    // set the cache
                    this._style = style;
                    this._orderedStyleLayers = this._prepareOrderedLayers(style);
                }

                if (this._orderedStyleLayers) {
                    for (const key of this._orderedStyleLayers) {
                        // retreive the corresponding layer
                        const styleLayer = style.layers[key];
                        const name = styleLayer.sourceLayer;
                        const layer = tile.layers[name];
                        // draw the layer
                        if (layer && this._acceptLayer(name, layer, styleLayer)) {
                            this._drawLayer(ctx, name, layer, w, h, styleLayer);
                        }
                    }
                }
            }
        }
    }

    protected _prepareOrderedLayers(style?: IVectorStyle): Array<number> | undefined {
        if (!style) {
            return undefined;
        }
        const groups = new Map<string | symbol, Array<number>>();
        const defaultSlot = Symbol();
        const length = style.layers.length;
        for (let i = 0; i < length; i++) {
            const value = style.layers[i];
            if (!value) {
                continue;
            }
            const slot = value.slot ?? defaultSlot;
            let group = groups.get(slot);
            if (!group) {
                group = [];
                groups.set(slot, group);
            }
            group.push(i);
        }
        return [...groups.values()].flat();
    }

    protected _drawLayer(ctx: CanvasRenderingContext2D, key: string, layer: IVectorTileLayer, w: number, h: number, styleLayer: IVectorLayerStyle): void {
        const extent = layer.extent;
        const scalex = w / extent;
        const scaley = h / extent;
        ctx.save();
        try {
            // set the style
            switch (styleLayer.type) {
                case LayerStyleTypes.Fill: {
                    // set the root fill style properties
                    const paint = styleLayer.paint as IFillPaintStyle;
                    if (!paint) {
                        break;
                    }
                    const color = this._evaluate(paint.color);
                    const outlineColor = this._evaluate(paint.outlineColor);
                    if (!color && !outlineColor) {
                        break;
                    }

                    if (color) {
                        ctx.fillStyle = color;
                    }

                    if (outlineColor) {
                        ctx.strokeStyle = outlineColor;
                        ctx.lineWidth = TileVectorRenderer.DefaultLineWith;
                    }

                    const opacity = this._evaluate(paint.opacity) ?? TileVectorRenderer.DefaultOpacity;
                    ctx.globalAlpha = opacity;

                    const translate = this._evaluate(paint.translate);

                    // loop over features
                    for (let i = 0; i < layer.length; i++) {
                        const feature = layer.feature(i);
                        if (feature && this._acceptFeature(feature, styleLayer)) {
                            switch (feature.type) {
                                case VectorTileGeomType.POLYGON: {
                                    const transformed = this._getTransformedGeometry(feature, scalex, scaley, translate);
                                    // fill polygon
                                    ctx.beginPath();
                                    for (const ring of transformed) {
                                        this._drawPath(ctx, ring);
                                        if (ring.length) ctx.closePath();
                                    }
                                    if (color) ctx.fill("evenodd");
                                    // draw outline
                                    if (outlineColor) {
                                        ctx.stroke();
                                    }
                                    break;
                                }
                                default:
                                    break;
                            }
                        }
                    }

                    break;
                }
                case LayerStyleTypes.Line: {
                    // set the root fill style properties

                    const paint = styleLayer.paint as ILinePaintStyle;
                    if (!paint) {
                        break;
                    }
                    const color = this._evaluate(paint.color);
                    if (!color) {
                        break;
                    }
                    ctx.strokeStyle = color;
                    const opacity = this._evaluate(paint.opacity) ?? TileVectorRenderer.DefaultOpacity;
                    ctx.globalAlpha = opacity;

                    const width = this._evaluate(paint.width);
                    ctx.lineWidth = width ?? TileVectorRenderer.DefaultLineWith;

                    const dasharray = this._evaluate(paint.dashArray);
                    if (dasharray) {
                        ctx.setLineDash(dasharray);
                    }

                    const translate = this._evaluate(paint.translate);

                    // loop over features
                    for (let i = 0; i < layer.length; i++) {
                        const feature = layer.feature(i);
                        if (feature && this._acceptFeature(feature, styleLayer)) {
                            switch (feature.type) {
                                case VectorTileGeomType.POLYGON:
                                case VectorTileGeomType.LINESTRING: {
                                    const transformed = this._getTransformedGeometry(feature, scalex, scaley, translate);
                                    // draw outline
                                    for (const line of transformed) {
                                        ctx.beginPath();
                                        this._drawPath(ctx, line);
                                        ctx.stroke();
                                    }
                                    break;
                                }
                                default:
                                    break;
                            }
                        }
                    }
                    break;
                }
                case LayerStyleTypes.Circle: {
                    const paint = styleLayer.paint as ICirclePaintStyle;
                    if (!paint) {
                        break;
                    }
                    const color = this._evaluate(paint.color);
                    const outlineColor = this._evaluate(paint.strockeColor);
                    if (!color && !outlineColor) {
                        break;
                    }
                    if (color) {
                        ctx.fillStyle = color;
                    }

                    const opacity = this._evaluate(paint.opacity) ?? TileVectorRenderer.DefaultOpacity;
                    ctx.globalAlpha = opacity;

                    // set the outline style properties
                    if (outlineColor) {
                        ctx.strokeStyle = outlineColor;
                        ctx.lineWidth = paint.strockeWidth ?? TileVectorRenderer.DefaultLineWith;
                    }

                    const translate = this._evaluate(paint.translate);
                    // loop over features
                    for (let i = 0; i < layer.length; i++) {
                        const feature = layer.feature(i);
                        if (feature && this._acceptFeature(feature, styleLayer)) {
                            switch (feature.type) {
                                case VectorTileGeomType.POINT: {
                                    const transformed = this._getTransformedGeometry(feature, scalex, scaley, translate);
                                    for (const points of transformed) {
                                        for (const point of points) {
                                            ctx.beginPath();
                                            ctx.arc(point.x, point.y, paint.radius, 0, 2 * Math.PI);
                                            if (color) ctx.fill();
                                            if (outlineColor) ctx.stroke();
                                        }
                                    }
                                    break;
                                }
                                default: {
                                    break;
                                }
                            }
                        }
                    }

                    break;
                }
                default: {
                    break;
                }
            }
        } finally {
            ctx.restore();
        }
    }

    protected _evaluate<T>(p: PropertyValueSpecification<T>): T | undefined {
        if (IsExpressionSpecification(p)) {
            // evaluate the expression
            return this._evaluateExpression<T>(p);
        }
        return p;
    }

    protected _evaluateExpression<T>(p: ExpressionSpecification): T | undefined {
        return undefined;
    }

    protected _getTransformedGeometry(feature: IVectorTileFeature, scalex: number, scaley: number, translate?: [number, number]): Array<Array<ICartesian2>> {
        const geom = feature.loadGeometry();
        const transformed: Array<Array<ICartesian2>> = [];
        for (let i = 0; i < geom.length; i++) {
            const points = geom[i].map((point) => ({
                x: point.x * scalex + (translate?.[0] ?? 0),
                y: point.y * scaley + (translate?.[1] ?? 0),
            }));
            transformed.push(feature.type === VectorTileGeomType.LINESTRING ? this._simplifier.simplify(points) : points);
        }
        return transformed;
    }

    protected _drawPolyline(ctx: CanvasRenderingContext2D, points: Array<ICartesian2>): void {
        this._drawPath(ctx, points);
    }

    protected _drawPolygon(ctx: CanvasRenderingContext2D, points: Array<Array<ICartesian2>>): void {}

    protected _drawPath(ctx: CanvasRenderingContext2D, points: Array<ICartesian2>): void {
        if (!points.length) return;
        let i = 0;
        let p = points[i];
        ctx.moveTo(p.x, p.y);
        if (i < points.length - 1) {
            do {
                p = points[++i];
                ctx.lineTo(p.x, p.y);
            } while (i < points.length - 1);
        }
    }

    protected _acceptLayer(key: string, layer: IVectorTileLayer, styleLayer: IVectorLayerStyle): boolean {
        return true;
    }

    protected _acceptFeature(layer: IVectorTileFeature, styleLayer: IVectorLayerStyle): boolean {
        return true;
    }
}
