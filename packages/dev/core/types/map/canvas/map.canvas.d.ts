import { ITileCollection, ITileDisplay, ITileMetrics } from "../../tiles/tiles.interfaces";
import { RGBAColor } from "../../math/math.color";
import { TileMapBase } from "../../tiles/map/tiles.map";
import { ITilePipeline } from "../../tiles/pipeline/tiles.pipeline.interfaces";
import { ITileNavigationApi } from "../../tiles/navigation/tiles.navigation.interfaces";
import { CanvasDisplay } from "./map.canvas.display";
import { Nullable } from "../../types";
type CanvasTileContentType = HTMLImageElement;
type FillRectFn = (ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) => void;
export declare class CanvasTileMapOptions {
    static DefaultBackground: RGBAColor;
    static Default: CanvasTileMapOptions;
    background?: RGBAColor;
    fillEmpty?: FillRectFn;
    constructor(p: Partial<CanvasTileMapOptions>);
}
export declare class CanvasTileMapOptionsBuilder {
    private _background?;
    _fillEmpty?: FillRectFn;
    withBackground(v: RGBAColor | number, g?: number, b?: number): CanvasTileMapOptionsBuilder;
    withFillEmptyFn(v: FillRectFn): CanvasTileMapOptionsBuilder;
    build(): CanvasTileMapOptions;
}
export declare abstract class AbstractContext2DTileMap extends TileMapBase<CanvasTileContentType> {
    _options: CanvasTileMapOptions;
    constructor(name: string, display: ITileDisplay, pipeline: ITilePipeline<CanvasTileContentType>, options?: CanvasTileMapOptions, nav?: ITileNavigationApi | ITileMetrics);
    protected _draw(ctx: CanvasRenderingContext2D): void;
    protected _drawLayer(ctx: CanvasRenderingContext2D, tiles: ITileCollection<CanvasTileContentType>): void;
    protected _doValidate(): void;
    protected abstract _getContext2D(): Nullable<CanvasRenderingContext2D>;
}
export declare class CanvasTileMap extends AbstractContext2DTileMap {
    _context: Nullable<CanvasRenderingContext2D>;
    constructor(name: string, display: CanvasDisplay, pipeline: ITilePipeline<CanvasTileContentType>, options?: CanvasTileMapOptions, nav?: ITileNavigationApi | ITileMetrics);
    protected _getContext2D(): Nullable<CanvasRenderingContext2D>;
}
export {};
