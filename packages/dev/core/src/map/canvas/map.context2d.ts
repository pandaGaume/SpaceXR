import { Scalar } from "../../math";
import { IDisplay, isDrawableTileMapLayer, ITileMapLayer, ITileNavigationState, TileMapBase } from "../../tiles";

// intermediary class to hold drawing process. This is usefull when the context is coming from other source than the class itself.
export class Context2DTileMap extends TileMapBase<unknown, ITileMapLayer<unknown>> {
    public constructor(display: IDisplay, nav?: ITileNavigationState) {
        super(display, nav);
    }

    /// <summary>
    /// Draw the map on the canvas.
    /// </summary>
    public draw(ctx: CanvasRenderingContext2D, xoffset: number = 0, yoffset: number = 0): void {
        if (!ctx || !this._display) {
            return;
        }
        if (!this._zIndexOrderedLayers || !this._zIndexOrderedLayers.length) {
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
            const scale = this.navigation.scale;

            // we clear the canvas
            ctx.clearRect(x, y, w, h);

            // we move the reference to the center of target bounds
            ctx.translate(x + w / 2, y + h / 2);

            // we rotate the canvas according the navigation azimuth
            if (this.navigation.azimuth?.value) {
                // convert azimuth to canvas rotation, which is clockwize, and cartesian
                const angle = this.navigation.azimuth.value * Scalar.DEG2RAD;
                ctx.rotate(angle);
            }

            // we scale the canvas according the navigation scale
            ctx.scale(scale, scale);

            for (const l of this._zIndexOrderedLayers ?? []) {
                const layer = l.layer;
                if (!layer.enabled) {
                    continue;
                }
                const render = isDrawableTileMapLayer(layer) ? layer.drawFn?.bind(layer.drawTarget ?? layer) : undefined;
                if (!render) {
                    continue;
                }
                const currentLod = this.navigation.lod;
                const lat = this.navigation.center.lat;
                const lon = this.navigation.center.lon;
                const metrics = l.metrics;
                const center = metrics.getLatLonToPointXY(lat, lon, currentLod);
                const size = metrics.tileSize;
                const tiles = l.activTiles;
                l.validate();
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
