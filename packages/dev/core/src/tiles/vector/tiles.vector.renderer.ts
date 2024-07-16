import { ICanvasRenderingContext } from "../../engine";
import { ICartesian2, PolylineSimplifier } from "../../geometry";
import { IVectorTileContent, IVectorTileFeature, IVectorTileLayer, VectorTileGeomType } from "./tiles.vector.interfaces";
import { IFillLayerStyle, IsFillLayerStyle, IsLineLayerStyle, IVectorLayerStyle, IVectorStyle, LayerStyleTypes } from "./tiles.vector.style.interface";

export class TileVectorRenderer {
    _simplifier: PolylineSimplifier<ICartesian2>;
    // cached style and ordered layers
    _style?: IVectorStyle;
    _orderedStyleLayers?: Array<string>;

    public constructor(simplifier: PolylineSimplifier<ICartesian2>, style?: IVectorStyle) {
        this._simplifier = simplifier ?? PolylineSimplifier.Shared;
        this._style = style;
        this._orderedStyleLayers = this._prepareOrderedLayers(style);
    }

    public renderTile(tile: IVectorTileContent, ctx: ICanvasRenderingContext, style?: IVectorStyle): void {
        const w = ctx.canvas.width;
        const h = ctx.canvas.height;
        ctx.clearRect(0, 0, w, h);

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
                        const layer = tile.layers[key];
                        const styleLayer = style.layers[key];
                        if (layer && this._acceptLayer(key, layer, styleLayer)) {
                            this._drawLayer(ctx, key, layer, w, h, styleLayer);
                        }
                    }
                }
            }
        }
    }

    protected _prepareOrderedLayers(style?: IVectorStyle): Array<string> | undefined {
        if (!style) {
            return undefined;
        }
        const a: Record<string, Array<string>> = {};
        const defaultSlot = this._generateUniqueSlotName();
        for (const [key, value] of Object.entries(style.layers)) {
            if (!value) {
                continue;
            }
            const slot = value.slot ?? defaultSlot;
            let group = a[slot];
            if (!group) {
                a[slot] = group = [];
            }
            group.push(key);
        }
        return Object.values(a).flat();
    }

    private _generateUniqueSlotName(): string {
        return `slot-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
    }

    protected _drawLayer(ctx: ICanvasRenderingContext, key: string, layer: IVectorTileLayer, w: number, h: number, styleLayer: IVectorLayerStyle): void {
        const extent = layer.extent;
        const scalex = w / extent;
        const scaley = h / extent;
        ctx.save();
        try {
            // set the style
            switch (styleLayer.type) {
                case LayerStyleTypes.Fill: {
                    let outline = false;
                    for (let i = 0; i < layer.length; i++) {
                        const feature = layer.feature(i);
                        if (feature && this._acceptFeature(feature, styleLayer)) {
                            switch (feature.type) {
                                case VectorTileGeomType.POLYGON: {
                                    const transformed = this._getTransformedGeometry(feature, scalex, scaley);
                                    // fill polygon
                                    ctx.beginPath();
                                    this._drawPath(ctx, transformed[0]);
                                    if (transformed.length > 1) {
                                        for (let i = 1; i < transformed.length; i++) {
                                            this._drawPath(ctx, transformed[i]);
                                        }
                                    }
                                    ctx.fill();
                                    // draw outline
                                    if (outline) {
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
                    for (let i = 0; i < layer.length; i++) {
                        const feature = layer.feature(i);
                        if (feature && this._acceptFeature(feature, styleLayer)) {
                            switch (feature.type) {
                                case VectorTileGeomType.POLYGON:
                                case VectorTileGeomType.LINESTRING: {
                                    const transformed = this._getTransformedGeometry(feature, scalex, scaley);
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
                default:
                    break;
            }
        } finally {
            ctx.restore();
        }
    }

    protected _getTransformedGeometry(feature: IVectorTileFeature, scalex: number, scaley: number): Array<Array<ICartesian2>> {
        const geom = feature.loadGeometry();
        const transformed: Array<Array<ICartesian2>> = [];
        for (let i = 0; i < geom.length; i++) {
            for (let j = 0; j < geom[i].length; j++) {
                geom[i][j].x *= scalex;
                geom[i][j].y *= scaley;
            }
            transformed.push(this._simplifier.simplify(geom[i]));
        }
        return transformed;
    }

    protected _drawPolyline(ctx: ICanvasRenderingContext, points: Array<ICartesian2>): void {
        this._drawPath(ctx, points);
    }

    protected _drawPolygon(ctx: ICanvasRenderingContext, points: Array<Array<ICartesian2>>): void {}

    protected _drawPath(ctx: ICanvasRenderingContext, points: Array<ICartesian2>): void {
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
