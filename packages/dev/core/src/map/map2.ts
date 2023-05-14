import { TileMapView2, UpdateEventArgs, UpdateReason } from "../tiles/tile.mapview";
import { ITile, ITileAddress, ITileDatasource, ITileMapApi, ITileMetrics, ITileMetricsProvider } from "../tiles/tiles.interfaces";
import { IGeo2 } from "../geography/geography.interfaces";
import { Geo2 } from "../geography/geography.position";
import { IDisplay } from "./map";
import { ICartesian2 } from "../geometry/geometry.interfaces";
import { Cartesian2 } from "../geometry/geometry.cartesian";

export abstract class AbstractDisplayMap<T, D extends IDisplay> implements ITileMetricsProvider, ITileMapApi {
    _display: D; // the display
    _view: TileMapView2<T>; // the view logic
    _activ: Map<string, ITile<T>>; // the list of activ tiles

    _lod: number = 0;
    _scale: number = 1;
    _center: ICartesian2 = Cartesian2.Zero();

    public constructor(display: D, datasource: ITileDatasource<T, ITileAddress>, metrics: ITileMetrics, center?: IGeo2, lod?: number) {
        this._display = display;
        this._view = new TileMapView2(datasource, metrics, display.width, display.height, center || Geo2.Zero(), lod || metrics.minLOD);
        this._view.updateObservable.add((e: UpdateEventArgs<T>) => this.onUpdate(e));
        this._activ = new Map<string, ITile<T>>();
        this._view.validate();
    }
    public invalidateSize(w: number, h: number): ITileMapApi {
        this._view.invalidateSize(w, h);
        this._view.validate();
        return this;
    }
    public setView(center: IGeo2, zoom?: number | undefined): ITileMapApi {
        this._view.setView(center, zoom);
        this._view.validate();
        return this;
    }
    public setZoom(zoom: number): ITileMapApi {
        this._view.setZoom(zoom);
        this._view.validate();
        return this;
    }
    public zoomIn(delta: number): ITileMapApi {
        this._view.zoomIn(delta);
        this._view.validate();
        return this;
    }
    public zoomOut(delta: number): ITileMapApi {
        this._view.zoomOut(delta);
        this._view.validate();
        return this;
    }
    public translate(tx: number, ty: number): ITileMapApi {
        this._view.translate(tx, ty);
        this._view.validate();
        return this;
    }

    public get view(): TileMapView2<T> {
        return this._view;
    }

    public get metrics(): ITileMetrics {
        return this.view.metrics;
    }

    protected onUpdate(args: UpdateEventArgs<T>): void {
        if (!args) {
            return;
        }

        switch (args.reason) {
            case UpdateReason.tileReady: {
                this.onUpdateTiles(args);
                break;
            }
            case UpdateReason.viewChanged:
            default: {
                this.onUpdateView(args);
                break;
            }
        }
    }

    protected onUpdateTiles(args: UpdateEventArgs<T>): void {
        // process tiles
        this.processRemoved(args);
        this.processAdded(args);

        // invalidate tiles
        this.invalidateTiles(args.added, args.removed);
    }

    protected onUpdateView(args: UpdateEventArgs<T>): void {
        // update the view parameters
        this._lod = args.lod;
        this._scale = args.scale;
        this._center = args.center;

        // process tiles
        this.processRemoved(args);
        this.processAdded(args);

        // invalidate display
        this.invalidateDisplay();
    }

    private processRemoved(args: UpdateEventArgs<T>): void {
        if (args.removed && args.removed.length != 0) {
            // this is the place to clean unactive tile
            for (const t of args.removed) {
                const key = t.address.quadkey;
                const old = this._activ.get(key);
                if (old) {
                    this._activ.delete(key);
                    this.onDeleted(key, old);
                }
            }
        }
    }

    private processAdded(args: UpdateEventArgs<T>): void {
        if (args.added && args.added.length != 0) {
            for (const t of args.added) {
                const key = t.address.quadkey;
                if (!this._activ.has(key)) {
                    this._activ.set(key, t);
                    this.onAdded(key, t);
                }
            }
        }
    }

    public abstract onDeleted(key: string, tile: ITile<T>): void;
    public abstract onAdded(key: string, tile: ITile<T>): void;
    public abstract invalidateDisplay(): void;
    public abstract invalidateTiles(added: ITile<T>[] | undefined, removed: ITile<T>[] | undefined): void;
}
