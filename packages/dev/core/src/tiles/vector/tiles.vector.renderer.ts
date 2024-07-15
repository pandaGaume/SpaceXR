import { ICanvasRenderingContext } from "../../engine";
import { ICartesian2, PolylineSimplifier } from "../../geometry";
import { IVectorTileContent, IVectorTileFeature, IVectorTileLayer, VectorTileGeomType } from "./tiles.vector.interfaces";

export class TileVectorRenderer {
    _simplifier: PolylineSimplifier<ICartesian2>;

    public constructor(simplifier: PolylineSimplifier<ICartesian2>) {
        this._simplifier = simplifier ?? PolylineSimplifier.Shared;
    }

    public renderTile(tile: IVectorTileContent, ctx: ICanvasRenderingContext): void {
        const w = ctx.canvas.width;
        const h = ctx.canvas.height;
        ctx.clearRect(0, 0, w, h);

        if (tile) {
            for (const [key, value] of Object.entries(tile.layers)) {
                if (value && this._acceptLayer(key, value)) {
                    this._drawLayer(ctx, key, value, w, h);
                }
            }
        }
    }

    protected _drawLayer(ctx: ICanvasRenderingContext, key: string, layer: IVectorTileLayer, w: number, h: number): void {
        const extent = layer.extent;
        const scalex = w / extent;
        const scaley = h / extent;
        for (let i = 0; i < layer.length; i++) {
            const feature = layer.feature(i);
            if (feature && this._acceptFeature(feature)) {
                this._drawFeature(ctx, feature, scalex, scaley);
            }
        }
    }

    protected _drawFeature(ctx: ICanvasRenderingContext, feature: IVectorTileFeature, scalex: number, scaley: number): void {
        const geom = feature.loadGeometry();

        const transformed: Array<Array<ICartesian2>> = [];
        for (let i = 0; i < geom.length; i++) {
            for (let j = 0; j < geom[i].length; j++) {
                geom[i][j].x *= scalex;
                geom[i][j].y *= scaley;
            }
            transformed.push(this._simplifier.simplify(geom[i]));
        }

        switch (feature.type) {
            case VectorTileGeomType.POINT:
                break;
            case VectorTileGeomType.LINESTRING:
                for (let i = 0; i < transformed.length; i++) {
                    this._drawPolyline(ctx, transformed[i]);
                }
                break;
            case VectorTileGeomType.POLYGON:
                for (let i = 0; i < transformed.length; i++) {
                    this._drawPolyline(ctx, transformed[i]);
                }
                break;
        }
    }

    protected _drawPolyline(ctx: ICanvasRenderingContext, points: Array<ICartesian2>): void {
        ctx.strokeStyle = "red";
        ctx.lineWidth = 1;

        ctx.beginPath();
        this._drawPath(ctx, points);
        ctx.stroke();
    }

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

    protected _acceptLayer(key: string, layer: IVectorTileLayer): boolean {
        return key == "contour";
    }

    protected _acceptFeature(layer: IVectorTileFeature): boolean {
        return true;
    }
}
