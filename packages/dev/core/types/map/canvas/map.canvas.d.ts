import { RGBAColor } from "../../math";
import { TileMapBase, ITileDisplay, ITileNavigationState, IImageTileMapLayer } from "../../tiles";
import { CanvasDisplay } from "./map.canvas.display";
import { Nullable } from "../../types";
import { ICanvasRenderingContext } from "../../engine/icanvas";
import { InputsNavigationTarget, MouseInputController } from "../inputs";
export type CanvasTileContentType = HTMLImageElement;
export interface ICanvasRenderingOptions {
    background?: string;
    alpha?: number;
}
export declare class Context2DTileMap extends TileMapBase<CanvasTileContentType, IImageTileMapLayer> implements ICanvasRenderingOptions {
    static DefaultBackground: RGBAColor;
    static DefaultOptions: ICanvasRenderingOptions;
    _background?: string;
    _alpha: number;
    constructor(name: string, display?: Nullable<ITileDisplay>, options?: ICanvasRenderingOptions, nav?: ITileNavigationState);
    get background(): string | undefined;
    set background(v: string | undefined);
    get alpha(): number;
    set alpha(v: number);
    draw(ctx: ICanvasRenderingContext, xoffset?: number, yoffset?: number): void;
}
export interface ICanvasMapOptions extends ICanvasRenderingOptions {
    navigationManager?: InputsNavigationTarget<HTMLCanvasElement>;
    inputController?: MouseInputController<HTMLCanvasElement>;
}
export declare class CanvasMap extends Context2DTileMap {
    _context: Nullable<CanvasRenderingContext2D>;
    _navigationManager: InputsNavigationTarget<HTMLCanvasElement>;
    _inputController: MouseInputController<HTMLCanvasElement>;
    constructor(name: string, display: CanvasDisplay | HTMLCanvasElement, options?: ICanvasMapOptions, nav?: ITileNavigationState);
    protected _doValidate(): void;
    protected _getContext2D(): Nullable<CanvasRenderingContext2D>;
}
