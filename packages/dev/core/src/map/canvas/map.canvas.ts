import { ITileDisplay } from "../../tiles/tiles.interfaces";
import { Scalar } from "../../math/math";
import { RGBAColor } from "../../math/math.color";
import { TileMapBase } from "../../tiles/map/tiles.map";
import { ITileNavigationState } from "../../tiles/navigation/tiles.navigation.interfaces";
import { CanvasDisplay } from "./map.canvas.display";
import { Nullable } from "../../types";
import { ITileMapLayer } from "core/tiles";

export type CanvasTileContentType = HTMLImageElement;

export type FillRectFn = (ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) => void;

export class CanvasTileMapOptions {
    public static DefaultBackground = RGBAColor.LightGray();
    public static Default = new CanvasTileMapOptions({ background: CanvasTileMapOptions.DefaultBackground });

    public background?: RGBAColor;
    public fillEmpty?: FillRectFn;

    public constructor(p: Partial<CanvasTileMapOptions>) {
        Object.assign(this, p);
    }
}

export class CanvasTileMapOptionsBuilder {
    private _background?: RGBAColor;
    public _fillEmpty?: FillRectFn;

    public withBackground(v: RGBAColor | number, g?: number, b?: number): CanvasTileMapOptionsBuilder {
        this._background = v instanceof RGBAColor ? v : new RGBAColor(v, g ?? 0, b ?? 0);
        return this;
    }

    public withFillEmptyFn(v: FillRectFn): CanvasTileMapOptionsBuilder {
        this._fillEmpty = v;
        return this;
    }

    public build(): CanvasTileMapOptions {
        return new CanvasTileMapOptions({ background: this._background, fillEmpty: this._fillEmpty });
    }
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
export abstract class AbstractContext2DTileMap extends TileMapBase<CanvasTileContentType> {
    _options: CanvasTileMapOptions;

    public constructor(name: string, display?: Nullable<ITileDisplay>, options?: CanvasTileMapOptions, nav?: ITileNavigationState) {
        super(name, display, nav);
        this._options = { ...CanvasTileMapOptions.Default, ...options };
    }

    /// <summary>
    /// Draw the map on the canvas.
    /// </summary>
    protected _draw(ctx: CanvasRenderingContext2D): void {
        if (!ctx || !this._display) {
            return;
        }
        ctx.save();

        // clear the canvas
        const res = this._display;
        const x = 0;
        const y = 0;
        if (this._options.background) {
            ctx.fillStyle = this._options.background.toString();
            ctx.fillRect(x, y, res.width, res.height);
        } else {
            ctx.clearRect(x, y, res.width, res.height);
        }

        if (!this._orderedLayers || !this._orderedLayers.length) {
            ctx.restore();
            return;
        }

        const scale = this.navigation.scale;
        // we move the reference to the center of the display
        ctx.translate(x + res.width / 2, y + res.height / 2);
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
    protected _drawLayer(ctx: CanvasRenderingContext2D, layer: ITileMapLayer<CanvasTileContentType>): void {
        const tiles = layer.getActiveTiles();
        if (!tiles || !tiles.count) {
            return;
        }

        const metrics = layer.metrics;
        const center = metrics.getLatLonToPixelXY(this.navigation.center.lat, this.navigation.center.lon, this.navigation.lod);
        const tileSize = metrics.tileSize;

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
                // this is where we fill the empty or unknown tile
                if (this._options?.fillEmpty) {
                    this._options?.fillEmpty(ctx, x, y, tileSize, tileSize);
                }
            }
        }
    }

    /// <summary>
    /// This method is called when the map is validated.
    /// </summary>
    protected _doValidate(): void {
        super._doValidate();
        const ctx = this._getContext2D();
        if (ctx) {
            this._draw(ctx);
        }
    }

    /// <summary>
    /// Provide the underlying canvas context 2D.
    /// <returns>the underlying canvas context 2D or null if not available.</returns>
    /// </summary>
    protected abstract _getContext2D(): Nullable<CanvasRenderingContext2D>;
}

export class CanvasMap extends AbstractContext2DTileMap {
    _context: Nullable<CanvasRenderingContext2D>;

    public constructor(name: string, display: CanvasDisplay | HTMLCanvasElement, options?: CanvasTileMapOptions, nav?: ITileNavigationState) {
        if (display instanceof HTMLCanvasElement) {
            display = new CanvasDisplay(display);
        }
        super(name, display, options, nav);
        this._context = display.getContext();
    }

    protected _getContext2D(): Nullable<CanvasRenderingContext2D> {
        return this._context;
    }
}
