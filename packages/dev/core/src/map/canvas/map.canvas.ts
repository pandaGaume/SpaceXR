import { ITileNavigationState } from "../../tiles";
import { CanvasDisplay } from "./map.canvas.display";
import { Nullable } from "../../types";
import { InputsNavigationMouseTarget, PointerInputController } from "../inputs";
import { Context2DTileMap } from "./map.context2d";

export interface ICanvasMapOptions {
    navigationManager?: InputsNavigationMouseTarget<HTMLCanvasElement>;
    inputController?: PointerInputController<HTMLCanvasElement>;
}

/// <summary>
/// Base class for a tile map using a canvas context like for rendering. The flow is the following:
/// - the map is updated by the pipeline, then the map is invalidated
/// - the map is asked for rendering, so validated: If the map is invalid, so the validable data flow is triggered and the map draw is called.
/// So this map is not automatically redrawed, it is only redrawed when asked for validation.
/// This is a design choice, because we want to be able to control the rendering flow. This is usefull for example when we want to render the map into a rendering pipleline, 2D or 3D
/// One way is using RequestAnimationFrame to trigger the rendering.
///  function updateFrame() {
///    // Update the animation frame
///    map.validate();
///
///    // Recursively request another frame update
///    requestAnimationFrame(updateFrame);
///  }
///  // Start the animation
///  requestAnimationFrame(updateFrame);
///
/// Additionaly, we may also use the Map in 3D rendering pipeline which obey to the same rule. The map May be a texture of a 3D object.
///
/// For pure HTML rendering, we may use the Map in a canvas 2D rendering pipeline and revalidate systematically after each operations, such as navigation, zoom, etc.
/// </summary>
export class CanvasMap<T> extends Context2DTileMap<T> {
    _context: Nullable<CanvasRenderingContext2D>;
    _navigationManager: InputsNavigationMouseTarget<HTMLCanvasElement>;
    _inputController: PointerInputController<HTMLCanvasElement>;

    public constructor(display: CanvasDisplay | HTMLCanvasElement, options?: ICanvasMapOptions, nav?: ITileNavigationState) {
        if (display instanceof HTMLCanvasElement) {
            display = new CanvasDisplay(display);
        }
        super(display, nav);
        this._context = display.getContext();

        this._navigationManager = options?.navigationManager ?? new InputsNavigationMouseTarget<HTMLCanvasElement>(this);
        this._inputController = options?.inputController ?? new PointerInputController(display.canvas, this._navigationManager);
    }

    /// <summary>
    /// This method is called when the map is validated.
    /// </summary>
    protected _doValidate(): void {
        super._doValidate();
        const ctx = this._getContext2D();
        if (ctx) {
            this.draw(ctx);
        }
    }

    protected _getContext2D(): Nullable<CanvasRenderingContext2D> {
        return this._context;
    }
}
