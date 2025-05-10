import { ITileNavigationState } from "../../tiles";
import { CanvasDisplay } from "./map.canvas.display";
import { Nullable } from "../../types";
import { InputsNavigationMouseTarget, PointerInputController } from "../inputs";
import { Context2DTileMap } from "./map.context2d";
export interface ICanvasMapOptions {
    navigationManager?: InputsNavigationMouseTarget<HTMLCanvasElement>;
    inputController?: PointerInputController<HTMLCanvasElement>;
}
export declare class CanvasMap<T> extends Context2DTileMap<T> {
    _context: Nullable<CanvasRenderingContext2D>;
    _navigationManager: InputsNavigationMouseTarget<HTMLCanvasElement>;
    _inputController: PointerInputController<HTMLCanvasElement>;
    constructor(display: CanvasDisplay | HTMLCanvasElement, options?: ICanvasMapOptions, nav?: ITileNavigationState);
    protected _doValidate(): void;
    protected _getContext2D(): Nullable<CanvasRenderingContext2D>;
}
