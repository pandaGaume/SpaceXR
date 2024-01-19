import { Scalar, RGBAColor } from "../../math";
import { TileMapBase, ITileDisplay, ITileMapLayer, ITileNavigationState } from "../../tiles";
import { CanvasDisplay } from "./map.canvas.display";
import { Nullable } from "../../types";
import { ICanvasRenderingContext } from "./map.canvas.interfaces";
import { InputsNavigationTarget, MouseInputController } from "../inputs";

export type CanvasTileContentType = HTMLImageElement;

// we delegate the rendering options.
export interface ICanvasRenderingOptions {
    background?: string;
}

/// <summary>
/// Abstract class for a tile map using a canvas as display. The flow is the following:
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
export class Context2DTileMap extends TileMapBase<CanvasTileContentType> {
    _renderOptions?: ICanvasRenderingOptions;

    public constructor(name: string, display?: Nullable<ITileDisplay>, options?: ICanvasRenderingOptions, nav?: ITileNavigationState) {
        super(name, display, nav);
        this._renderOptions = options;
    }

    /// <summary>
    /// Draw the map on the canvas.
    /// </summary>
    public draw(ctx: ICanvasRenderingContext): void {
        if (!ctx || !this._display) {
            return;
        }
        ctx.save();

        // clear the canvas
        const res = this._display;
        const x = 0;
        const y = 0;
        if (this._renderOptions?.background) {
            ctx.fillStyle = this._renderOptions.background;
            ctx.fillRect(x, y, res.displayWidth, res.displayHeight);
        } else {
            ctx.clearRect(x, y, res.displayWidth, res.displayHeight);
        }

        if (!this._orderedLayers || !this._orderedLayers.length) {
            ctx.restore();
            return;
        }

        const scale = this.navigation.scale;
        // we move the reference to the center of the display
        ctx.translate(x + res.displayWidth / 2, y + res.displayHeight / 2);
        // we scale the canvas according the navigation scale
        ctx.scale(scale, scale);
        // we rotate the canvas according the navigation azimuth
        if (this.navigation.azimuth?.value) {
            // convert azimuth to canvas rotation, which is clockwize, and cartesian
            const angle = this.navigation.azimuth.value * Scalar.DEG2RAD;
            ctx.rotate(angle);
        }
        // every tiles are supposed to got the same size here, using same metrics
        for (const l of this._orderedLayers ?? []) {
            if (l.enabled) {
                ctx.globalAlpha = l.alpha;
                this._drawLayer(ctx, l);
            }
        }
        ctx.restore();
    }

    /// <summary>
    /// Draw the layer on the canvas. This method is messaged from the draw method.
    /// </summary>
    protected _drawLayer(ctx: ICanvasRenderingContext, layer: ITileMapLayer<CanvasTileContentType>): void {
        const tiles = layer.getActiveTiles();
        if (!tiles || !tiles.count) {
            return;
        }

        const metrics = layer.metrics;
        const center = metrics.getLatLonToPixelXY(this.navigation.center.lat, this.navigation.center.lon, this.navigation.lod);

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
                }
            }
        }
    }
}

export interface ICanvasMapOptions extends ICanvasRenderingOptions {
    navigationManager?: InputsNavigationTarget<HTMLCanvasElement>;
    inputController?: MouseInputController<HTMLCanvasElement>;
}

export class CanvasMap extends Context2DTileMap {
    public static DefaultBackground = RGBAColor.LightGray();

    public static DefaultOptions: ICanvasRenderingOptions = {
        background: CanvasMap.DefaultBackground.toHexString(),
    };

    _context: Nullable<CanvasRenderingContext2D>;
    _navigationManager: InputsNavigationTarget<HTMLCanvasElement>;
    _inputController: MouseInputController<HTMLCanvasElement>;

    public constructor(name: string, display: CanvasDisplay | HTMLCanvasElement, options?: ICanvasMapOptions, nav?: ITileNavigationState) {
        if (display instanceof HTMLCanvasElement) {
            display = new CanvasDisplay(display);
        }
        const o = { ...CanvasMap.DefaultOptions, ...options };
        super(name, display, o, nav);
        this._context = display.getContext();

        this._navigationManager = o.navigationManager ?? new InputsNavigationTarget<HTMLCanvasElement>(this);
        this._inputController = o.inputController ?? new MouseInputController(display.canvas, this._navigationManager);
    }

    /// <summary>
    /// This method is called when the map is validated.
    /// </summary>
    protected _doValidate(): void {
        super._doValidate();
        const ctx: ICanvasRenderingContext = this._getContext2D() as ICanvasRenderingContext;
        if (ctx) {
            this.draw(ctx);
        }
    }

    protected _getContext2D(): Nullable<CanvasRenderingContext2D> {
        return this._context;
    }
}
