import { TileMapView, UpdateEvents } from "../tiles/tiles.view";
import { IRectangle, ISize2 } from "../geometry/geometry.interfaces";
import { ITile, ITileDirectory, ITileMetrics, ITileMetricsProvider } from "../tiles/tiles.interfaces";
import { Cartesian2 } from "../geometry/geometry.cartesian";
import { TileMetrics } from "../tiles/tiles.metrics";
import { IGeo2 } from "../geography/geography.interfaces";

export interface IDisplay extends ISize2 {}

export abstract class AbstractTileMap<T, D extends IDisplay> implements ITileMetricsProvider {
    _display: D;

    _view: TileMapView; // the view logic
    _directory?: ITileDirectory<ITile<T>>; // the tile data source
    _activ: Map<string, ITile<T>>; // the list of activ tiles

    _pixelBounds?: IRectangle; // this is a copy of the curent pixel bounds of the view
    _scale: Cartesian2; //
    _lod: number;

    public constructor(display: D, directory?: ITileDirectory<ITile<T>>, lat?: number, lon?: number, zoom?: number) {
        this._display = display;
        this._directory = directory;
        this._view = new TileMapView(display.width, display.height, lat, lon, zoom, directory?.metrics);
        this._view.updateObservable.add(((e: UpdateEvents) => this.onUpdate(e)).bind(this));
        this._activ = new Map<string, ITile<T>>();
        this._scale = Cartesian2.One();
        this._view.validate();
        this._lod = 0;
    }

    public invalidateSize(w?: number, h?: number) {
        this._view.resize(w || this._display.width, h || this._display.height).validate();
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
        this.setZoom((this._view.levelOfDetail * TileMapView.ZOOM_ACC + Math.abs(delta * TileMapView.ZOOM_ACC)) / TileMapView.ZOOM_ACC);
    }

    public zoomOut(delta: number) {
        this.setZoom((this._view.levelOfDetail * TileMapView.ZOOM_ACC - Math.abs(delta * TileMapView.ZOOM_ACC)) / TileMapView.ZOOM_ACC);
    }

    public translate(tx: number, ty: number) {
        this._view.translate(tx, ty).validate();
    }

    public get metrics(): ITileMetrics {
        return this._view.metrics;
    }

    private onUpdate(e: UpdateEvents) {
        if (!e) {
            return;
        }

        this._pixelBounds = e.bounds;
        this._scale = e.scale;
        this._lod = e.lod;

        if (e.removed && e.removed.size != 0) {
            // this is the place to clean unactive tile
            for (const entry of e.removed.entries()) {
                const old = this._activ.get(entry[0]);
                if (old) {
                    this._activ.delete(entry[0]);
                    this.onDeleted(entry[0], old);
                }
            }
        }

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
                                        ((tile: ITile<T> | undefined) => {
                                            if (tile) {
                                                const a = tile.address;
                                                const key = a.quadkey || TileMetrics.TileXYToQuadKey(a);
                                                this._activ.set(key, tile);
                                                this.onAdded(key, tile);

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
                            const tile: ITile<T> = result;
                            const a = tile.address;
                            const key = a.quadkey || TileMetrics.TileXYToQuadKey(a);
                            this._activ.set(key, tile);
                            this.onAdded(key, tile);
                        }
                    }
                }
            }
        }
        this.draw(true);
    }

    public abstract onDeleted(key: string, tile: ITile<T>): void;
    public abstract onAdded(key: string, tile: ITile<T>): void;
    public abstract draw(clear?: boolean, tile?: Array<ITile<T>>): void;
}
