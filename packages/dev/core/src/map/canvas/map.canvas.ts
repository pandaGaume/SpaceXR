import { ITile, ITileDisplay, ITileMetrics } from "../../tiles/tiles.interfaces";

import { IRectangle } from "../../geometry/geometry.interfaces";
import { Scalar } from "../../math/math";
import { RGBAColor } from "../../math/math.color";

import { TileMapBase } from "../../tiles/map/tiles.map";
import { ITilePipeline } from "../../tiles/pipeline/tiles.pipeline.interfaces";
import { ITileNavigationApi } from "../../tiles/navigation/tiles.navigation.interfaces";

type CanvasTileContentType = HTMLImageElement;

type FillRectFn = (ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) => void;

export class CanvasTileMapOptions {
    public static DefaultBackground = RGBAColor.LightGray();
    public static DefaultColor = RGBAColor.Gray();
    public static Default = new CanvasTileMapOptions({ background: CanvasTileMapOptions.DefaultBackground, color: CanvasTileMapOptions.DefaultColor });

    public background?: RGBAColor;
    public color?: RGBAColor;
    public fillEmpty?: FillRectFn;

    public constructor(p: Partial<CanvasTileMapOptions>) {
        Object.assign(this, p);
    }
}

export class CanvasTileMapOptionsBuilder {
    private _backColor?: RGBAColor;
    private _foreColor?: RGBAColor;
    public _fillEmpty?: FillRectFn;

    public withBackground(v: RGBAColor | number, g?: number, b?: number): CanvasTileMapOptionsBuilder {
        this._backColor = v instanceof RGBAColor ? v : new RGBAColor(v, g ?? 0, b ?? 0);
        return this;
    }

    public withColor(v: RGBAColor | number, g?: number, b?: number): CanvasTileMapOptionsBuilder {
        this._foreColor = v instanceof RGBAColor ? v : new RGBAColor(v, g ?? 0, b ?? 0);
        return this;
    }

    public withFillEmptyFn(v: FillRectFn): CanvasTileMapOptionsBuilder {
        this._fillEmpty = v;
        return this;
    }

    public build(): CanvasTileMapOptions {
        return new CanvasTileMapOptions({ background: this._backColor, color: this._foreColor, fillEmpty: this._fillEmpty });
    }
}

export abstract class AbstractContext2DTileMap extends TileMapBase<CanvasTileContentType> {
    _options: CanvasTileMapOptions;

    public constructor(
        name: string,
        display: ITileDisplay,
        pipeline: ITilePipeline<CanvasTileContentType>,
        options?: CanvasTileMapOptions,
        nav?: ITileNavigationApi | ITileMetrics
    ) {
        super(name, display, pipeline, nav);
        this._options = { ...CanvasTileMapOptions.Default, ...options };
    }

    protected _draw(ctx: CanvasRenderingContext2D, tiles: IterableIterator<ITile<CanvasTileContentType>> | Array<ITile<CanvasTileContentType>>) {
        if (ctx) {
            const scale = this.navigation.scale;
            const center = this.navigation.pixelXY;
            const res = this._display;
            ctx.translate(res.width / 2, res.height / 2);
            ctx.scale(scale, scale);
            if (this.navigation.azimuth) {
                // convert azimuth to canvas rotation, which is clockwize, and cartesian
                const angle = this.navigation.azimuth.value * Scalar.DEG2RAD;
                ctx.rotate(angle);
            }
            const tileSize = this.navigation.metrics.tileSize;
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

    protected abstract _getContext2D(): CanvasRenderingContext2D | null;
}
