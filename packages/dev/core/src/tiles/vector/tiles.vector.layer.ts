import { IDrawableTileMapLayer } from "../map/tiles.map.interfaces";

import { TileMapLayer } from "../map";
import { VectorTileProvider } from "./tiles.vector.provider";
import { IShape, isLine, isPolygon, isPolyline } from "../../geometry/shapes/geometry.shapes.interfaces";
import { EPSG3857 } from "../geography/tiles.geography.EPSG3857";
import { PolylineSimplifier } from "../../geometry/geometry.simplify";
import { ICanvasRenderingContext } from "../../engine";
import { ICartesian3 } from "../../geometry";
import { IVectorTileStyle, IVectorLayer, IVectorTileContent, IVectorLayerOptions, IVectorTileLayer, IVectorTileFeature } from "./tiles.vector.interfaces";
import { VectorStyle } from "./tiles.vector.style";

export class VectorLayer extends TileMapLayer<IVectorTileContent> implements IVectorLayer, IDrawableTileMapLayer {
    protected _style?: IVectorTileStyle;
    protected _styles?: Map<string, IVectorTileStyle>;

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
        this._style = options?.style;
        this._styles = options?.styles;
    }

    public draw(ctx: ICanvasRenderingContext): void {
        if (this.enabled && this.activTiles) {
            ctx.save();
            try {
                const center = this.metrics.getLatLonToPointXY(this.navigation.center.lat, this.navigation.center.lon, this.navigation.lod);

                for (const t of this.activTiles) {
                    const b = t.bounds;
                    if (b) {
                        const x = b.x - center.x;
                        const y = b.y - center.y;
                        const item = t.content ?? null; // trick to address erroness tile.
                        if (item) {
                            this._drawTile(ctx, x, y, item);
                        }
                    }
                }
            } finally {
                ctx.restore();
            }
        }
    }

    protected _drawTile(ctx: ICanvasRenderingContext, x: number, y: number, content: IVectorTileContent): void {
        if (content) {
            let i = 0;

            for (const [key, layer] of content) {
                if (i == 2) {
                    ctx.save();
                    try {
                        ctx.translate(x, y);
                        this._drawLayer(ctx, key, layer);
                    } finally {
                        ctx.restore();
                    }
                }
                i++;
            }
        }
    }

    protected _drawLayer(ctx: ICanvasRenderingContext, key: string, layer: IVectorTileLayer): void {
        const extent = layer.extent ?? this.metrics.tileSize;
        const scale = this.metrics.tileSize / extent;
        const style = this._styles?.get(key) ?? this._style ?? {};
        for (const feature of layer.features ?? []) {
            this._drawFeature(ctx, feature, style, scale);
        }
    }
    protected _drawFeature(ctx: ICanvasRenderingContext, feature: IVectorTileFeature, style: IVectorTileStyle, scale: number): void {
        if (!feature.shape) {
            return;
        }
        const shape = feature.shape;
        if (Array.isArray(shape)) {
            for (const s of shape) {
                this._drawShape(ctx, s, style, scale);
            }
        } else {
            this._drawShape(ctx, shape, style, scale);
        }
    }

    protected _drawShape(ctx: ICanvasRenderingContext, s: IShape, style: IVectorTileStyle, scale: number): void {
        if (isLine(s)) {
            this._drawPolyline(ctx, [s.start, s.end], style, scale);
            return;
        }

        if (isPolyline(s)) {
            this._drawPolyline(ctx, s.points, style, scale);
            return;
        }

        if (isPolygon(s)) {
            this._drawPolygon(ctx, s.points, s.holes, style, scale);
            return;
        }
    }

    protected _drawPolyline(ctx: ICanvasRenderingContext, points: Array<ICartesian3>, o: IVectorTileStyle, scale: number, close: boolean = false): void {
        if (o.dashArray) {
            ctx.setLineDash(o.dashArray);
        }
        ctx.strokeStyle = o.color ?? VectorStyle.DefaultStrokeStyle;
        ctx.lineWidth = o.weight ?? VectorStyle.DefaultWeight;
        ctx.beginPath();
        this._drawPath(ctx, points, scale);
        ctx.stroke();
    }

    protected _drawPolygon(ctx: ICanvasRenderingContext, points: Array<ICartesian3>, holes: Array<Array<ICartesian3>> | undefined, o: IVectorTileStyle, scale: number): void {
        ctx.fillStyle = o.fillColor ?? VectorStyle.DefaultFillStyle;
        ctx.globalAlpha = o.fillOpacity ?? VectorStyle.DefaultOpacity;
        ctx.beginPath();

        points = points.map((p) => ({ x: p.x * scale, y: p.y * scale, z: 0 }));

        PolylineSimplifier.Shared.simplify(points);

        this._drawPath(ctx, points, 1);

        if (holes && holes.length) {
            for (let hole of holes) {
                hole = hole.map((p) => ({ x: p.x * scale, y: p.y * scale, z: 0 }));

                PolylineSimplifier.Shared.simplify(hole);

                this._drawPath(ctx, hole, 1);
            }
        }

        ctx.fill();
    }

    protected _drawPath(ctx: ICanvasRenderingContext, points: Array<ICartesian3>, scale: number): void {
        let i = 0;
        let p = points[i];
        let px = p.x * scale;
        let py = p.y * scale;
        ctx.moveTo(px, py);
        if (i < points.length - 1) {
            do {
                p = points[++i];
                px = p.x * scale;
                py = p.y * scale;
                ctx.lineTo(px, py);
            } while (i < points.length - 1);
        }
    }

    _drawInvPath(ctx: ICanvasRenderingContext, points: Array<ICartesian3>, scale: number): void {
        let i = points.length - 1;
        let p = points[i];
        let px = p.x * scale;
        let py = p.y * scale;
        ctx.moveTo(px, py);
        if (i > 0) {
            do {
                p = points[--i];
                px = p.x * scale;
                py = p.y * scale;
                ctx.lineTo(px, py);
            } while (i > 0);
        }
    }
}
