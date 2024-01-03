import { ITileDisplay, ITileMetrics } from "../../tiles/tiles.interfaces";
import { RGBAColor } from "../../math/math.color";
import { TileMapBase } from "../../tiles/map/tiles.map";
import { ITilePipeline } from "../../tiles/pipeline/tiles.pipeline.interfaces";
import { ITileNavigationState } from "../../tiles/navigation/tiles.navigation.interfaces";
import { CanvasDisplay } from "./map.canvas.display";
import { Nullable } from "../../types";
import { ITileMapLayer } from "core/tiles";
export type CanvasTileContentType = HTMLImageElement;
export type FillRectFn = (ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) => void;
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
    constructor(name: string, display?: Nullable<ITileDisplay>, pipeline?: ITilePipeline<CanvasTileContentType>, options?: CanvasTileMapOptions, nav?: ITileNavigationState | ITileMetrics);
    protected _draw(ctx: CanvasRenderingContext2D): void;
    protected _drawLayer(ctx: CanvasRenderingContext2D, layer: ITileMapLayer<CanvasTileContentType>): void;
    protected _doValidate(): void;
    protected abstract _getContext2D(): Nullable<CanvasRenderingContext2D>;
}
export declare class CanvasMap extends AbstractContext2DTileMap {
    _context: Nullable<CanvasRenderingContext2D>;
    constructor(name: string, display: CanvasDisplay | HTMLCanvasElement, pipeline?: ITilePipeline<CanvasTileContentType>, options?: CanvasTileMapOptions, nav?: ITileNavigationState | ITileMetrics);
    protected _getContext2D(): Nullable<CanvasRenderingContext2D>;
}
