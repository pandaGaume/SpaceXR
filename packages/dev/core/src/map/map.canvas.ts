import { IGeo2 } from "../geography/geography.interfaces";
import { ITile, ITileDirectory, ITileMetrics } from "../tiles/tiles.interfaces";
import { UpdateEvents, View2 } from "../tiles/tiles.view";
import { TileMetrics } from "../tiles/tiles.metrics";
import { IRectangle } from "../geometry/geometry.interfaces";
import { Cartesian2 } from "../geometry/geometry.cartesian";

export class CanvasTileMap {
    _canvas: HTMLCanvasElement; // the 2D target
    _view: View2<HTMLImageElement>; // the view logic
    _directory?: ITileDirectory<HTMLImageElement>; // the tiel data source
    _cache: Map<string, ITile<HTMLImageElement>>; // the list of activ tiles
    _bounds?: IRectangle; // this is a copy of the curent pixel bounds of the view
    _scale: Cartesian2; //

    public constructor(canvas: HTMLCanvasElement, directory?: ITileDirectory<HTMLImageElement>, lat?: number, lon?: number, zoom?: number) {
        this._canvas = canvas;
        this._directory = directory;
        this._view = new View2(canvas.width, canvas.height, lat, lon, zoom, directory?.metrics);
        this._view.updateObservable.add(((e: UpdateEvents) => this.onUpdate(e)).bind(this));
        this._cache = new Map<string, ITile<HTMLImageElement>>();
        this._scale = Cartesian2.One();
        this._view.validate();
    }

    /// public API begin

    public get center(): IGeo2 {
        return this._view._center;
    }

    public invalidateSize(w?: number, h?: number) {
        this._view.resize(w || this._canvas.clientWidth, h || this._canvas.clientHeight).validate();
    }

    public setView(center: IGeo2, zoom?: number) {
        this._view.center(center.lat, center.lon);
        if (zoom) {
            this._view.setLevelOfDetail(zoom);
        }
        this._view.validate();
    }

    public setZoom(zoom: number) {
        this._view.setLevelOfDetail(zoom).validate();
    }

    public zoomIn(delta: number) {
        this.setZoom((this._view.levelOfDetail * View2.ZOOM_ACC + Math.abs(delta * View2.ZOOM_ACC)) / View2.ZOOM_ACC);
    }

    public zoomOut(delta: number) {
        this.setZoom((this._view.levelOfDetail * View2.ZOOM_ACC - Math.abs(delta * View2.ZOOM_ACC)) / View2.ZOOM_ACC);
    }

    public translate(tx: number, ty: number) {
        this._view.translate(tx, ty).validate();
    }

    /// public API End
    private get metrics(): ITileMetrics {
        return this._view.metrics;
    }

    private onUpdate(e: UpdateEvents) {
        if (!e) {
            return;
        }

        this._bounds = e.bounds;
        this._scale = e.scale;

        console.log("TileMap.onUpdate() with ", e.toString());

        if (e.added && e.added.size != 0) {
            // this is the place to add new tiles from the directory
            for (const c of e.added.entries()) {
                if (this._directory) {
                    if (this.metrics.isValidAddress(c[1])) {
                        const result = this._directory.lookupAsync(c[1]);
                        if (result) {
                            if (result instanceof Promise) {
                                // we get an async result
                                result
                                    .then(
                                        ((tile: ITile<HTMLImageElement> | undefined) => {
                                            if (tile) {
                                                const a = tile.address;
                                                const key = a.quadkey || TileMetrics.TileXYToQuadKey(a);
                                                this._cache.set(key, tile);

                                                if (tile.data) {
                                                    this.draw(false, [tile]);
                                                }
                                            }
                                        }).bind(this)
                                    )
                                    .catch((e) => {
                                        console.log("Error when lookup", c.toString(), e);
                                    });
                                continue;
                            }
                            // Tile was in cache
                            const tile: ITile<HTMLImageElement> = result;
                            const a = tile.address;
                            const key = a.quadkey || TileMetrics.TileXYToQuadKey(a);
                            this._cache.set(key, tile);
                        }
                    }
                }
            }
        }

        if (e.removed && e.removed.size != 0) {
            // this is the place to clean unactive tile
            for (const key of e.removed.keys()) {
                this._cache.delete(key);
            }
        }

        this.draw();
    }

    private draw(clear: boolean = true, images?: Array<ITile<HTMLImageElement>>) {
        if (this._bounds) {
            const ctx = this._canvas.getContext("2d");
            if (ctx) {
                const center = this._bounds.center;
                const metrics = this.metrics;
                const temp = Cartesian2.Zero();

                if (clear) {
                    ctx.clearRect(0, 0, this._canvas.width, this._canvas.height);
                }
                ctx.save();
                ctx.translate(this._canvas.width / 2, this._canvas.height / 2);
                ctx.scale(this._scale.x, this._scale.y);
                const list = images || this._cache.values();
                for (const t of list) {
                    if (t.data) {
                        const a = t.address;

                        const pixelXY = metrics.getTileXYToPixelXY(a.x, a.y, a.levelOfDetail, temp);
                        pixelXY.x -= center.x;
                        pixelXY.y -= center.y;
                        ctx.drawImage(t.data, pixelXY.x, pixelXY.y);
                    }
                }
                ctx.restore();
            }
        }
    }
}
