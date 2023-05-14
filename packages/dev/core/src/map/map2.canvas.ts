import { ITile, ITileAddress, ITileDatasource, ITileMetrics } from "../tiles/tiles.interfaces";
import { AbstractDisplayMap } from "./map2";
import { CanvasDisplay } from "./map.canvas";
import { IGeo2 } from "../geography/geography.interfaces";
import { IRectangle } from "../geometry/geometry.interfaces";
import { Rectangle } from "..";

export class CanvasTileMap2 extends AbstractDisplayMap<HTMLImageElement, CanvasDisplay> {
    public constructor(canvas: HTMLCanvasElement, datasource: ITileDatasource<HTMLImageElement, ITileAddress>, metrics: ITileMetrics, center?: IGeo2, lod?: number) {
        super(new CanvasDisplay(canvas), datasource, metrics, center, lod);
    }

    public onDeleted(key: string, tile: ITile<HTMLImageElement>): void {}
    public onAdded(key: string, tile: ITile<HTMLImageElement>): void {}

    public invalidateTiles(added: ITile<HTMLImageElement>[] | undefined, removed: ITile<HTMLImageElement>[] | undefined): void {
        if (added) {
            const ctx = this._display.getContext();
            if (ctx) {
                this.invalidate(ctx, added);
            }
        }
    }

    public invalidateDisplay(rect?: IRectangle) {
        const ctx = this._display.getContext();
        if (ctx) {
            rect = rect || new Rectangle(0, 0, this._display.width, this._display.height);
            ctx.clearRect(rect.x, rect.y, rect.width, rect.height);
            this.invalidate(ctx, this._activ.values());
        }
    }

    private invalidate(ctx: CanvasRenderingContext2D, tiles: IterableIterator<ITile<HTMLImageElement>> | Array<ITile<HTMLImageElement>>) {
        if (ctx) {
            const scale = this._scale;
            const center = this._center;
            ctx.save();
            ctx.translate(this._display.width / 2, this._display.height / 2);
            ctx.scale(scale, scale);
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
