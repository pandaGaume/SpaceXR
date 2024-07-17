import { ICanvasRenderingContext } from "core/engine";
import { VectorTile } from "@mapbox/vector-tile";
import Protobuf from "pbf";
import { CanvasTileCodec, ITileMetrics, TileVectorRenderer } from "core/tiles";
import { Nullable } from "core/types";
import { IVectorStyle } from "core/tiles/vector/tiles.vector.style.interface";

export class VectorTileCodec extends CanvasTileCodec<VectorTile> {
    public static CreateCanvas(width: number, height: number): HTMLCanvasElement {
        const canvas = <HTMLCanvasElement>document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        return canvas;
    }

    _renderer: TileVectorRenderer;

    public constructor(metrics: ITileMetrics, render: TileVectorRenderer | IVectorStyle) {
        super(VectorTileCodec.CreateCanvas(metrics.tileSize, metrics.tileSize));
        if (render instanceof TileVectorRenderer) {
            this._renderer = render;
        } else {
            this._renderer = new TileVectorRenderer(render);
        }
    }

    protected async _decodeDataAsync(r: Response): Promise<Awaited<Nullable<VectorTile>>> {
        const b = await r.blob();
        if (b) {
            return new VectorTile(new Protobuf(await b.arrayBuffer()));
        }
        return null;
    }

    protected _render(ctx: ICanvasRenderingContext, tile: VectorTile, style?: IVectorStyle): void {
        this._renderer.renderTile(tile, ctx, style);
    }
}
