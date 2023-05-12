import { ITile, ITileDirectory } from "../tiles/tiles.interfaces";
import { Cartesian2 } from "../geometry/geometry.cartesian";
import { AbstractTileMap, IDisplay } from "./map";
import { ISize2 } from "../geometry/geometry.interfaces";

export class CanvasDisplay implements IDisplay {
    public constructor(public canvas: HTMLCanvasElement) {}

    public getContext(options?: CanvasRenderingContext2DSettings | undefined): CanvasRenderingContext2D | null {
        return this.canvas.getContext("2d", options);
    }

    public get height(): number {
        return this.canvas.clientHeight;
    }

    public get width(): number {
        return this.canvas.clientWidth;
    }

    public equals(other: ISize2): boolean {
        return this.height === other.height && this.width === other.width;
    }
}

export class CanvasTileMap extends AbstractTileMap<HTMLImageElement, CanvasDisplay> {
    public constructor(canvas: HTMLCanvasElement, directory?: ITileDirectory<ITile<HTMLImageElement>>, lat?: number, lon?: number, zoom?: number) {
        super(new CanvasDisplay(canvas), directory, lat, lon, zoom);
    }

    public onDeleted(key: string, tile: ITile<HTMLImageElement>): void {}
    public onAdded(key: string, tile: ITile<HTMLImageElement>): void {}

    public draw(clear: boolean = true, tiles?: Array<ITile<HTMLImageElement>>) {
        if (this._pixelBounds) {
            const ctx = this._display.getContext();
            if (ctx) {
                const center = this._pixelBounds.center;
                const metrics = this.metrics;
                const temp = Cartesian2.Zero();

                if (clear) {
                    ctx.clearRect(0, 0, this._display.width, this._display.height);
                }
                ctx.save();
                ctx.translate(this._display.width / 2, this._display.height / 2);
                ctx.scale(this._scale.x, this._scale.y);
                const list = tiles || this._activ.values();
                for (const t of list) {
                    if (t.data) {
                        const a = t.address;
                        const pixelXY = metrics.getTileXYToPixelXY(a.x, a.y, a.levelOfDetail, temp);
                        pixelXY.x -= center.x;
                        pixelXY.y -= center.y;
                        ctx.drawImage(t.data, pixelXY.x, pixelXY.y);
                    }
                }
                ctx.restore();
            }
        }
    }
}
