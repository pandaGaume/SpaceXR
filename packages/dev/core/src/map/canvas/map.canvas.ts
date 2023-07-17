import { ITile, ITileAddress, ITileDatasource } from "../../tiles/tiles.interfaces";
import { AbstractDisplayMap } from "../map";
import { IGeo2 } from "../../geography/geography.interfaces";
import { IRectangle } from "../../geometry/geometry.interfaces";
import { Rectangle } from "../../geometry/geometry.rectangle";
import { Scalar } from "../../math/math";
import { CanvasDisplay } from "./map.canvas.display";

export class CanvasTileMap extends AbstractDisplayMap<HTMLImageElement, ITile<HTMLImageElement>, CanvasDisplay> {
    _observer: ResizeObserver;

    public constructor(canvas: HTMLCanvasElement, datasource: ITileDatasource<HTMLImageElement, ITileAddress>, center?: IGeo2, lod?: number) {
        super(new CanvasDisplay(canvas), datasource, center, lod);
        this._observer = new ResizeObserver(() => {
            this.invalidateSize(canvas.width, canvas.height);
        });
        this._observer.observe(canvas);
    }

    protected onDeleted(key: string, tile: ITile<HTMLImageElement>): void {}
    protected onAdded(key: string, tile: ITile<HTMLImageElement>): void {}

    protected invalidateTiles(added: ITile<HTMLImageElement>[] | undefined, removed: ITile<HTMLImageElement>[] | undefined): void {
        if (added) {
            const ctx = this._display.getContext();
            if (ctx) {
                this.invalidate(ctx, added);
            }
        }
    }

    protected invalidateDisplay(rect?: IRectangle) {
        const ctx = this._display.getContext();
        if (ctx) {
            const res = this._display.resolution;
            rect = rect || new Rectangle(0, 0, res.width, res.height);
            ctx.clearRect(rect.x, rect.y, rect.width, rect.height);
            this.invalidate(ctx, this._activ.values());
        }
    }

    private invalidate(ctx: CanvasRenderingContext2D, tiles: IterableIterator<ITile<HTMLImageElement>> | Array<ITile<HTMLImageElement>>) {
        if (ctx) {
            const scale = this._scale;
            const center = this._center;
            ctx.save();
            const res = this._display.resolution;
            ctx.translate(res.width / 2, res.height / 2);
            ctx.scale(scale, scale);
            if (this.azimuth) {
                // convert azimuth to canvas rotation, which is clockwize, and cartesian
                const angle = this.azimuth * Scalar.DEG2RAD;
                ctx.rotate(angle);
            }
            for (const t of tiles) {
                if (t.content && t.rect) {
                    const x = t.rect.x - center.x;
                    const y = t.rect.y - center.y;
                    ctx.drawImage(t.content, x, y);
                }
            }
            ctx.restore();
        }
    }
}
