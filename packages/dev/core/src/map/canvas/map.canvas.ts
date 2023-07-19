import { ITile, ITileAddress, ITileDatasource } from "../../tiles/tiles.interfaces";
import { AbstractDisplayMap } from "../map";
import { IGeo2 } from "../../geography/geography.interfaces";
import { IRectangle } from "../../geometry/geometry.interfaces";
import { Rectangle } from "../../geometry/geometry.rectangle";
import { Scalar } from "../../math/math";
import { CanvasDisplay } from "./map.canvas.display";

type CanvasTileContentType = HTMLImageElement;

export class CanvasTileMap extends AbstractDisplayMap<CanvasTileContentType, ITile<CanvasTileContentType>, CanvasDisplay> {
    _observer: ResizeObserver;

    public constructor(canvas: HTMLCanvasElement, datasource: ITileDatasource<CanvasTileContentType, ITileAddress>, center?: IGeo2, lod?: number) {
        super(new CanvasDisplay(canvas), datasource, center, lod);
        this._observer = new ResizeObserver(() => {
            this.invalidateSize(canvas.width, canvas.height);
        });
        this._observer.observe(canvas);
    }

    protected onDeleted(key: string, tile: ITile<CanvasTileContentType>): void {}
    protected onAdded(key: string, tile: ITile<CanvasTileContentType>): void {}

    protected invalidateTiles(added: ITile<CanvasTileContentType>[] | undefined, removed: ITile<CanvasTileContentType>[] | undefined): void {
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

    private invalidate(ctx: CanvasRenderingContext2D, tiles: IterableIterator<ITile<CanvasTileContentType>> | Array<ITile<CanvasTileContentType>>) {
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
                    const contents = t.content;
                    if (contents.length) {
                        for (const item of contents) {
                            if (item) {
                                if (item instanceof HTMLImageElement) {
                                    ctx.drawImage(item, x, y);
                                    continue;
                                }
                                // this is a view
                                if (item.data) {
                                    const w = item.data.width;
                                    const h = item.data.height;
                                    const sx = item.source?.x ?? 0;
                                    const sy = item.source?.y ?? 0;
                                    const sw = item.source?.width ?? w;
                                    const sh = item.source?.height ?? h;
                                    ctx.drawImage(item.data, sx, sy, sw, sh, x, y, w, h);
                                }
                            }
                        }
                    }
                }
            }
            ctx.restore();
        }
    }
}
