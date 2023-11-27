import { ITile, ITileAddress, ITileDatasource } from "../../tiles/tiles.interfaces";
import { AbstractDisplayMap } from "../map";
import { IGeo2 } from "../../geography/geography.interfaces";
import { IRectangle } from "../../geometry/geometry.interfaces";
import { Rectangle } from "../../geometry/geometry.rectangle";
import { Scalar } from "../../math/math";
import { CanvasDisplay } from "./map.canvas.display";
import { RGBAColor } from "../../math/math.color";
import { TileContentManager } from "../../tiles/tiles.content.manager";

type CanvasTileContentType = HTMLImageElement;
type FillRectFn = (ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) => void;
export class CanvasTileMapOptions {
    public static DefaultBackColor = RGBAColor.LightGray();
    public static DefaultForeColor = RGBAColor.Gray();
    public static Default = new CanvasTileMapOptions({ backColor: CanvasTileMapOptions.DefaultBackColor, foreColor: CanvasTileMapOptions.DefaultForeColor });

    public backColor?: RGBAColor;
    public foreColor?: RGBAColor;
    public fillEmpty?: FillRectFn;

    public constructor(p: Partial<CanvasTileMapOptions>) {
        Object.assign(this, p);
    }
}

export class CanvasTileMapOptionsBuilder {
    private _backColor?: RGBAColor;
    private _foreColor?: RGBAColor;
    public _fillEmpty?: FillRectFn;

    public withBackColor(v: RGBAColor | number, g?: number, b?: number): CanvasTileMapOptionsBuilder {
        this._backColor = v instanceof RGBAColor ? v : new RGBAColor(v, g ?? 0, b ?? 0);
        return this;
    }

    public withForeColor(v: RGBAColor | number, g?: number, b?: number): CanvasTileMapOptionsBuilder {
        this._foreColor = v instanceof RGBAColor ? v : new RGBAColor(v, g ?? 0, b ?? 0);
        return this;
    }

    public withFillEmptyFn(v: FillRectFn): CanvasTileMapOptionsBuilder {
        this._fillEmpty = v;
        return this;
    }

    public build(): CanvasTileMapOptions {
        return new CanvasTileMapOptions({ backColor: this._backColor, foreColor: this._foreColor, fillEmpty: this._fillEmpty });
    }
}

export class CanvasTileMap extends AbstractDisplayMap<CanvasTileContentType, ITile<CanvasTileContentType>, CanvasDisplay> {
    _observer: ResizeObserver;
    _options: CanvasTileMapOptions;

    public constructor(canvas: HTMLCanvasElement, datasource: ITileDatasource<CanvasTileContentType, ITileAddress>, center?: IGeo2, lod?: number, options?: CanvasTileMapOptions) {
        super(new CanvasDisplay(canvas), new TileContentManager<CanvasTileContentType>(datasource), center, lod);
        this._options = { ...CanvasTileMapOptions.Default, ...options };
        this._observer = new ResizeObserver(() => {
            this.invalidateSize(canvas.width, canvas.height);
        });
        this._observer.observe(canvas);
    }

    protected onDeleted(key: string, tile: ITile<CanvasTileContentType>): void {}
    protected onAdded(key: string, tile: ITile<CanvasTileContentType>): void {}
    protected onUpdated(key: string, tile: ITile<CanvasTileContentType>): void {}

    protected invalidateTiles(added: ITile<CanvasTileContentType>[] | undefined, removed: ITile<CanvasTileContentType>[] | undefined): void {
        if (added) {
            const ctx = this._display.getContext();
            if (ctx) {
                ctx.save();
                ctx.strokeStyle = this._options?.foreColor?.toString() ?? CanvasTileMapOptions.DefaultForeColor.toString();
                this.invalidate(ctx, added);
                ctx.restore();
            }
        }
    }

    protected invalidateDisplay(rect?: IRectangle) {
        const ctx = this._display.getContext();
        if (ctx) {
            ctx.save();
            const res = this._display.resolution;
            rect = rect || new Rectangle(0, 0, res.width, res.height);
            ctx.fillStyle = this._options?.backColor?.toString() ?? CanvasTileMapOptions.DefaultBackColor.toString();
            ctx.strokeStyle = this._options?.foreColor?.toString() ?? CanvasTileMapOptions.DefaultForeColor.toString();
            ctx.fillRect(rect.x, rect.y, rect.width, rect.height);
            this.invalidate(ctx, this._activ.values());
            ctx.restore();
        }
    }

    private invalidate(ctx: CanvasRenderingContext2D, tiles: IterableIterator<ITile<CanvasTileContentType>> | Array<ITile<CanvasTileContentType>>) {
        if (ctx) {
            const scale = this._scale * 10;
            const center = this._center;
            const res = this._display.resolution;
            ctx.translate(res.width / 2, res.height / 2);
            ctx.scale(scale, scale);
            if (this.azimuth) {
                // convert azimuth to canvas rotation, which is clockwize, and cartesian
                const angle = this.azimuth * Scalar.DEG2RAD;
                ctx.rotate(angle);
            }
            const tileSize = this.metrics.tileSize;
            for (const t of tiles) {
                if (t.rect) {
                    const x = t.rect.x - center.x;
                    const y = t.rect.y - center.y;
                    const item = t.content ?? null; // trick to address erroness tile.
                    if (item) {
                        if (item instanceof HTMLImageElement) {
                            ctx.drawImage(item, x, y);
                            continue;
                        }
                        // this is a view...
                    } else {
                        // this is where we fill the empty tile
                        if (this._options?.fillEmpty) {
                            this._options?.fillEmpty(ctx, x, y, tileSize, tileSize);
                            continue;
                        }
                        let s = tileSize;
                        ctx.strokeRect(x, y, s, s);
                    }
                }
            }
        }
    }
}
