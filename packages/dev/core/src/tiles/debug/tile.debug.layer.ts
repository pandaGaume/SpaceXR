import { EPSG3857 } from "../geography";
import { ITileMapLayerOptions, TileMapLayer } from "../map";
import { ITile, ITileMetricsProvider } from "../tiles.interfaces";
import { DebugProvider } from "./tile.debug.provider";

export interface IDebugLayerOptions<T> extends ITileMapLayerOptions<T>, ITileMetricsProvider {
    target?: any;
}

export class DebugLayer<T> extends TileMapLayer<T> {
    public constructor(name: string, data: T, options?: IDebugLayerOptions<T>, enabled?: boolean) {
        const metrics = options?.metrics ?? EPSG3857.Shared;
        const provider = new DebugProvider<T>(name, metrics, data);
        super(name, provider, options, enabled);
        this._draw = this._draw ?? this._renderTile.bind(this);
    }

    protected _renderTile(ctx: CanvasRenderingContext2D, tile: ITile<T>, w: number, h: number): void {
        const text = tile.address.quadkey;

        const localx = 0;
        const localy = 0;

        // Set font properties
        ctx.font = "10px Arial";
        ctx.fillStyle = "red";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";

        // Calculate the center of the tile
        const centerX = localx + w / 2;
        const centerY = localy + h / 2;

        // Draw the text at the center
        ctx.fillText(text, centerX, centerY);
    }
}
