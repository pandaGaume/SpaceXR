import { RGBAColor } from "../../math";
import { TileMapBase, ITileDisplay, ITileMapLayer, ITileNavigationState } from "../../tiles";
import { CanvasDisplay } from "./map.canvas.display";
import { Nullable } from "../../types";
import { ICanvasRenderingContext } from "./map.canvas.interfaces";
import { InputsNavigationTarget, MouseInputController } from "../inputs";
export type CanvasTileContentType = HTMLImageElement;
export interface ICanvasRenderingOptions {
    background?: string;
}
export declare class Context2DTileMap extends TileMapBase<CanvasTileContentType> {
    _renderOptions?: ICanvasRenderingOptions;
    constructor(name: string, display?: Nullable<ITileDisplay>, options?: ICanvasRenderingOptions, nav?: ITileNavigationState);
    draw(ctx: ICanvasRenderingContext): void;
    protected _drawLayer(ctx: ICanvasRenderingContext, layer: ITileMapLayer<CanvasTileContentType>): void;
}
export interface ICanvasMapOptions extends ICanvasRenderingOptions {
    navigationManager: InputsNavigationTarget<HTMLCanvasElement>;
    inputController: MouseInputController<HTMLCanvasElement>;
}
export declare class CanvasMap extends Context2DTileMap {
    static DefaultBackground: RGBAColor;
    static DefaultOptions: ICanvasRenderingOptions;
    _context: Nullable<CanvasRenderingContext2D>;
    _navigationManager: InputsNavigationTarget<HTMLCanvasElement>;
    _inputController: MouseInputController<HTMLCanvasElement>;
    constructor(name: string, display: CanvasDisplay | HTMLCanvasElement, options?: ICanvasMapOptions, nav?: ITileNavigationState);
    protected _doValidate(): void;
    protected _getContext2D(): Nullable<CanvasRenderingContext2D>;
}
