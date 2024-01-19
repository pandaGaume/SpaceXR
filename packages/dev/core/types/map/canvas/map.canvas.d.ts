import { RGBAColor } from "../../math";
import { TileMapBase, ITileDisplay, ITileMapLayer, ITileNavigationState } from "../../tiles";
import { CanvasDisplay } from "./map.canvas.display";
import { Nullable } from "../../types";
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
    constructor(name: string, display?: Nullable<ITileDisplay>, options?: CanvasTileMapOptions, nav?: ITileNavigationState);
    protected _draw(ctx: CanvasRenderingContext2D): void;
    protected _drawLayer(ctx: CanvasRenderingContext2D, layer: ITileMapLayer<CanvasTileContentType>): void;
    protected _doValidate(): void;
    protected abstract _getContext2D(): Nullable<CanvasRenderingContext2D>;
}
export declare class CanvasMap extends AbstractContext2DTileMap {
    _context: Nullable<CanvasRenderingContext2D>;
    constructor(name: string, display: CanvasDisplay | HTMLCanvasElement, options?: CanvasTileMapOptions, nav?: ITileNavigationState);
    protected _getContext2D(): Nullable<CanvasRenderingContext2D>;
}
