import { ITile, ITileAddress, ITileDatasource, ITileMetrics } from "../tiles/tiles.interfaces";
import { AbstractDisplayMap, IMapDisplay } from "./map";
import { IGeo2 } from "../geography/geography.interfaces";
import { IRectangle, ISize2 } from "../geometry/geometry.interfaces";
import { Rectangle } from "../geometry/geometry.rectangle";
import { Size2 } from "../geometry/geometry.size";
import { Scalar } from "../math/math";

export class CanvasDisplay implements IMapDisplay {
    public constructor(public canvas: HTMLCanvasElement) {
        this.resizeToDisplaySize();
    }

    public getContext(options?: CanvasRenderingContext2DSettings | undefined): CanvasRenderingContext2D | null {
        return this.canvas.getContext("2d", options);
    }

    public get resolution(): ISize2 {
        return new Size2(this.canvas.width, this.canvas.height);
    }

    /**
     * Check what size that element is being displayed (clientWidth & clientHeight properties) and then adjust
     * its drawingbuffer size (width & height properties) to match.
     * Let's call this function just before we render so it will always adjust the canvas to our desired size just before drawing.
     * @returns
     */
    public resizeToDisplaySize(scale: number = 1): boolean {
        // Lookup the size the browser is displaying the canvas in CSS pixels.
        const displayWidth = this.canvas.clientWidth;
        const displayHeight = this.canvas.clientHeight;

        // Set actual size in memory (scaled to account for extra pixel density).
        const ratio = window.devicePixelRatio;
        const w = displayWidth * ratio * scale;
        const h = displayHeight * ratio * scale;

        if (this.canvas.width != w || this.canvas.height != h) {
            // Make the canvas the same size
            this.canvas.width = w;
            this.canvas.height = h;
            return true;
        }
        return false;
    }
}

export class CanvasTileMap extends AbstractDisplayMap<HTMLImageElement, ITile<HTMLImageElement>, CanvasDisplay> {
    _observer: ResizeObserver;

    public constructor(canvas: HTMLCanvasElement, datasource: ITileDatasource<HTMLImageElement, ITileAddress>, metrics: ITileMetrics, center?: IGeo2, lod?: number) {
        super(new CanvasDisplay(canvas), datasource, metrics, center, lod);
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
            if (this.rotation) {
                const angle = this.rotation * Scalar.DEG2RAD;
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
