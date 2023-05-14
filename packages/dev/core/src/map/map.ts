import { TileMapView, UpdateEvents } from "../tiles/tiles.view";
import { IRectangle, ISize2 } from "../geometry/geometry.interfaces";
import { ITile, ITileDirectory, ITileMetrics, ITileMetricsProvider, LookupResult } from "../tiles/tiles.interfaces";
import { Cartesian2 } from "../geometry/geometry.cartesian";
import { TileMetrics } from "../tiles/tiles.metrics";
import { IGeo2 } from "../geography/geography.interfaces";
import { Nullable } from "../types";

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

        const allSettled: boolean = false;

        if (e.added && e.added.size != 0) {
            // this is the place to add new tiles from the directory
            if (!allSettled) {
                Array.from(e.added.entries()).forEach((c) => {
                    if (this._directory) {
                        if (this.metrics.isValidAddress(c[1])) {
                            this._directory
                                .lookupAsync(c[1])
                                .then(
                                    ((result: LookupResult<Nullable<ITile<T>>>) => {
                                        const tile = result.content;
                                        if (tile) {
                                            const a = tile.address;
                                            const key = a.quadkey || TileMetrics.TileXYToQuadKey(a);
                                            this._activ.set(key, tile);
                                            this.onAdded(key, tile);

                                            if (tile.content) {
                                                this._tilequeue.push(tile);
                                                if (this._tilequeue.length === 1) {
                                                    queueMicrotask((() => this.dequeue()).bind(this));
                                                }
                                            }
                                        }
                                    }).bind(this)
                                )
                                .catch((e) => {});
                        }
                    }
                });
            } else {
                Promise.allSettled(
                    Array.from(e.added.entries()).map((c) => {
                        return this._directory!.lookupAsync(c[1]).then(
                            ((result: LookupResult<Nullable<ITile<T>>>) => {
                                const tile = result.content;
                                if (tile) {
                                    const a = tile.address;
                                    const key = a.quadkey || TileMetrics.TileXYToQuadKey(a);
                                    this._activ.set(key, tile);
                                    this.onAdded(key, tile);
                                }
                                return tile;
                            }).bind(this)
                        );
                    })
                ).then((res) => {
                    const tiles = res.filter((r) => r.status === "fulfilled").map((r) => (<any>r).value);
                    this.draw(false, tiles);
                });
            }
        }
        this.draw(true);
    }

    _tilequeue: Array<ITile<T>> = [];

    private dequeue(): void {
        if (this._tilequeue.length) {
            console.log("Draw", this._tilequeue.length, "image(s)");
            const copy = this._tilequeue.slice();
            this._tilequeue.length = 0;
            queueMicrotask(() => this.draw(false, copy));
        }
    }

    public abstract onDeleted(key: string, tile: ITile<T>): void;
    public abstract onAdded(key: string, tile: ITile<T>): void;
    public abstract draw(clear?: boolean, tile?: Array<ITile<T>>): void;
}
