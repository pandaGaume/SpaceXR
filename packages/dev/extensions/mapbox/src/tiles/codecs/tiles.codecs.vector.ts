import { ICanvasRenderingContext } from "core/engine";
import { VectorTile } from "@mapbox/vector-tile";
import Protobuf from "pbf";
import { CanvasTileCodec, ITileMetrics, IVectorTile, TileVectorRenderer } from "core/tiles";
import { PolylineSimplifier } from "core/geometry/geometry.simplify";
import { ICartesian2 } from "core/geometry";
import { Nullable } from "core/types";

declare module "@mapbox/vector-tile" {
    export interface VectorTile extends IVectorTile {}
}

export class VectorTileCodec extends CanvasTileCodec<VectorTile> {
    public static CreateCanvas(width: number, height: number): HTMLCanvasElement {
        const canvas = <HTMLCanvasElement>document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        return canvas;
    }

    _simplifier: PolylineSimplifier<ICartesian2>;
    _renderer: TileVectorRenderer;

    public constructor(metrics: ITileMetrics) {
        super(VectorTileCodec.CreateCanvas(metrics.tileSize, metrics.tileSize));
        this._simplifier = new PolylineSimplifier<ICartesian2>();
        this._renderer = new TileVectorRenderer(this._simplifier);
    }

    protected async _decodeDataAsync(r: Response): Promise<Awaited<Nullable<VectorTile>>> {
        const b = await r.blob();
        if (b) {
            return new VectorTile(new Protobuf(await b.arrayBuffer()));
        }
        return null;
    }

    protected _render(ctx: ICanvasRenderingContext, tile: VectorTile): void {
        this._renderer.renderTile(tile, ctx);
    }
}
