import { ICanvasRenderingContext } from "../../engine";
import { EPSG3857 } from "../geography";
import { IDrawableTileMapLayer, ITileMapLayerOptions, TileMapLayer } from "../map";
import { ITile, ITileMetrics } from "../tiles.interfaces";
import { DebugProvider } from "./tile.debug.provider";

type TileMapLayerDrawFn<T> = (ctx: ICanvasRenderingContext, x: number, y: number, tile: ITile<T>) => void;

export interface IDebugLayerOptions<T> extends ITileMapLayerOptions {
    metrics?: ITileMetrics;
    function?: TileMapLayerDrawFn<T>;
    target?: any;
}

export class DebugLayer<T> extends TileMapLayer<T> implements IDrawableTileMapLayer {
    private _function?: TileMapLayerDrawFn<any>;
    private _target?: any;

    public constructor(name: string, data: T, options?: IDebugLayerOptions<T>, enabled?: boolean) {
        const metrics = options?.metrics ?? EPSG3857.Shared;
        const provider = new DebugProvider<T>(name, metrics, data);
        super(name, provider, options, enabled);
        this._function = options?.function;
    }

    public draw(ctx: ICanvasRenderingContext): void {
        const fn = this._function ?? this._draw;
        if (this.enabled && this.activTiles) {
            const center = this.metrics.getLatLonToPointXY(this.navigation.center.lat, this.navigation.center.lon, this.navigation.lod);

            for (const t of this.activTiles) {
                const b = t.bounds;
                if (b) {
                    const x = b.x - center.x;
                    const y = b.y - center.y;
                    fn.call(this._target ?? this, ctx, x, y, t);
                }
            }
        }
    }

    protected _draw(ctx: ICanvasRenderingContext, x: number, y: number, tile: ITile<T>): void {
        const text = tile.address.quadkey;
        const rect = tile.bounds;

        const localx = (rect?.xmin ?? x) - x;
        const localy = (rect?.ymin ?? y) - y;
        console.log(`local x: ${localx}, local y: ${localy} to ${text}`);
        const w = rect?.width ?? this.metrics.tileSize;
        const h = rect?.height ?? this.metrics.tileSize;

        // Set font properties
        ctx.font = "10px Arial";
        ctx.fillStyle = "red";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";

        // Calculate the center of the canvas
        const centerX = localx + w / 2;
        const centerY = localy + h / 2;

        // Draw the text at the center
        ctx.fillText(text, centerX, centerY);
    }
}
