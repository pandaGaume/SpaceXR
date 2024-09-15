import { Scalar } from "../../math";
import { IDisplay, IsDrawableTileMapLayer, ITileMapLayer, ITileNavigationState, TileMapBase } from "../../tiles";

// intermediary class to hold drawing process. This is usefull when the context is coming from other source than the class itself.
export class Context2DTileMap<T> extends TileMapBase<T> {
    public constructor(display: IDisplay, nav?: ITileNavigationState) {
        super(display, nav);
    }

    /// <summary>
    /// Draw the map on the canvas.
    /// </summary>
    public draw(ctx: CanvasRenderingContext2D, xoffset: number = 0, yoffset: number = 0): void {
        const navigation = this.navigationState;
        if (!navigation) {
            return;
        }

        if (!ctx || !this._display) {
            return;
        }
        if (!this._layerViews.count) {
            return;
        }

        const display = this.display;
        if (!display) {
            return;
        }

        ctx.save();
        try {
            const x = xoffset;
            const y = yoffset;
            const w = display.resolution.width;
            const h = display.resolution.height;
            const scale = this.navigationState?.scale ?? 1.0;

            // we clear the canvas
            ctx.clearRect(x, y, w, h);

            // we move the reference to the center of target bounds
            ctx.translate(x + w / 2, y + h / 2);

            // we rotate the canvas according the navigation azimuth
            if (this.navigationState?.azimuth?.value) {
                // convert azimuth to canvas rotation, which is clockwize, and cartesian
                const angle = this.navigationState.azimuth.value * Scalar.DEG2RAD;
                ctx.rotate(angle);
            }

            // we scale the canvas according the navigation scale
            ctx.scale(scale, scale);

            for (const view of this._layerViews) {
                // we access the layer to get renders functions
                const layer: ITileMapLayer<T> = view.layer;
                if (!layer.enabled) {
                    continue;
                }
                const render = IsDrawableTileMapLayer(layer) ? layer.drawFn?.bind(layer.drawTarget ?? layer) : undefined;
                if (!render) {
                    continue;
                }
                const currentLod = navigation.lod;
                const lat = navigation.center.lat;
                const lon = navigation.center.lon;
                const metrics = layer.metrics;
                const center = metrics.getLatLonToPointXY(lat, lon, currentLod);
                const size = metrics.tileSize;

                const tiles = view.activTiles;
                for (const tile of tiles) {
                    const b = tile?.bounds;
                    if (!b || !tile.content) {
                        continue;
                    }
                    const dlod = currentLod - tile.address.levelOfDetail; // delta lod
                    const lodScaling = dlod == 0 ? 1 : dlod < 0 ? 1 << dlod : 1 / (1 << dlod);
                    const x = b.x * lodScaling - center.x;
                    const y = b.y * lodScaling - center.y;
                    ctx.save();
                    try {
                        ctx.translate(x, y);
                        ctx.scale(lodScaling, lodScaling);
                        render(ctx, tile, size, size);
                    } finally {
                        ctx.restore();
                    }
                    continue;
                }
            }
        } finally {
            ctx.restore();
        }
    }
}
