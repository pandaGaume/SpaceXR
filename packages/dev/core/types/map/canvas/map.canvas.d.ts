import { ITileNavigationState } from "../../tiles";
import { CanvasDisplay } from "./map.canvas.display";
import { Nullable } from "../../types";
import { Context2DTileMap } from "./map.context2d";
import { InputController, InputsNavigationController } from "../inputs";
export interface ICanvasMapOptions {
    navigationManager?: InputsNavigationController;
    inputController?: InputController<HTMLCanvasElement>;
}
export declare class CanvasMap<T> extends Context2DTileMap<T> {
    _context: Nullable<CanvasRenderingContext2D>;
    _navigationManager: InputsNavigationController;
    _inputController: InputController<HTMLCanvasElement>;
    constructor(display: CanvasDisplay | HTMLCanvasElement, options?: ICanvasMapOptions, nav?: ITileNavigationState);
    protected _doValidate(): void;
    protected _getContext2D(): Nullable<CanvasRenderingContext2D>;
}
