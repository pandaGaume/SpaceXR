import { ICanvasRenderingContext } from "core/engine";
import { VectorTile } from "@mapbox/vector-tile";
import { CanvasTileCodec, ITileMetrics, TileVectorRenderer } from "core/tiles";
import { Nullable } from "core/types";
import { IVectorStyle } from "core/tiles/vector/tiles.vector.style.interface";
import { VectorTileCodec } from "./tiles.codecs.vector";

export class VectorToImageTileCodec extends CanvasTileCodec<VectorTile> {
    public static CreateCanvas(width: number, height: number): HTMLCanvasElement {
        const canvas = <HTMLCanvasElement>document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        return canvas;
    }

    _renderer: TileVectorRenderer;
    _codec: VectorTileCodec;

    public constructor(metrics: ITileMetrics, render: TileVectorRenderer | IVectorStyle) {
        super(VectorToImageTileCodec.CreateCanvas(metrics.tileSize, metrics.tileSize));
        if (render instanceof TileVectorRenderer) {
            this._renderer = render;
        } else {
            this._renderer = new TileVectorRenderer(render);
        }
        this._codec = new VectorTileCodec();
    }

    protected async _decodeDataAsync(r: Response): Promise<Awaited<Nullable<VectorTile>>> {
        return await this._codec.decodeAsync(r);
    }

    protected _render(ctx: ICanvasRenderingContext, tile: VectorTile, style?: IVectorStyle): void {
        this._renderer.renderTile(tile, ctx, style);
    }
}
