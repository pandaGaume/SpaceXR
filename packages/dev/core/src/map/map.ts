import { TileMapView, UpdateEventArgs, UpdateReason } from "../tiles/tiles.mapview";
import { ITile, ITileAddress, ITileMetrics, ITileMetricsProvider } from "../tiles/tiles.interfaces";
import { ITileMapApi } from "../tiles/api/tiles.api.interfaces";
import { IGeo2 } from "../geography/geography.interfaces";
import { Geo2 } from "../geography/geography.position";
import { ICartesian2, IRectangle, ISize2, ISize3 } from "../geometry/geometry.interfaces";
import { Cartesian2 } from "../geometry/geometry.cartesian";
import { Observable, Observer } from "../events/events.observable";
import { PropertyChangedEventArgs } from "../events/events.args";
import { ITileContentProvider } from "core/tiles/pipeline/tiles.pipeline.interfaces";

export interface IMapDisplay {
    resolution: ISize3;
}

export abstract class AbstractDisplayMap<V, T extends ITile<V>, D extends IMapDisplay> implements ITileMetricsProvider, ITileMapApi {
    _display: D; // the display
    _view: TileMapView<V>; // the view logic
    _activ: Map<string, T>; // the list of activ tiles

    _lod: number = 0;
    _scale: number = 1;
    _center: ICartesian2 = Cartesian2.Zero();

    _addedObservable?: Observable<T>;
    _removedObservable?: Observable<T>;
    _updatedObservable?: Observable<T>;

    public constructor(display: D, manager: ITileContentProvider<V,ITileAddress>, center?: IGeo2, lod?: number) {
        this._display = display;
        this._view = new TileMapView(manager, display.resolution.width, display.resolution.height, center || Geo2.Zero(), lod || manager.metrics.minLOD);
        this._view.updateObservable.add(this.onUpdate.bind(this));
        this._activ = new Map<string, T>();
    }

    public get addedObservable(): Observable<T> {
        this._addedObservable = this._addedObservable || new Observable<T>(this.onAddedObserverAdded.bind(this));
        return this._addedObservable!;
    }

    public get removedObservable(): Observable<T> {
        this._removedObservable = this._removedObservable || new Observable<T>(this.onRemovedObserverAdded.bind(this));
        return this._removedObservable!;
    }

    public get updatedObservable(): Observable<T> {
        this._updatedObservable = this._updatedObservable || new Observable<T>(this.onUpdatedObserverAdded.bind(this));
        return this._updatedObservable!;
    }

    public hasTile(key: string): boolean {
        return this._activ.has(key);
    }

    public getTile(key: string): T | undefined {
        return this._activ.get(key);
    }

    public get width(): number {
        return this._view.width;
    }

    public get height(): number {
        return this._view.height;
    }

    public get resizeObservable(): Observable<PropertyChangedEventArgs<ITileMapApi, ISize2>> {
        return this._view.resizeObservable;
    }

    public get centerObservable(): Observable<PropertyChangedEventArgs<ITileMapApi, IGeo2>> {
        return this._view.centerObservable;
    }

    public get zoomObservable(): Observable<PropertyChangedEventArgs<ITileMapApi, number>> {
        return this._view.zoomObservable;
    }

    public get azimuthObservable(): Observable<PropertyChangedEventArgs<ITileMapApi, number>> {
        return this._view.azimuthObservable;
    }
    public get viewChangedObservable(): Observable<ITileMapApi> {
        return this._view.viewChangedObservable;
    }

    public get center(): IGeo2 {
        return this._view.center;
    }
    public get zoom(): number {
        return this._view.zoom;
    }
    public get levelOfDetail(): number {
        return this._view.levelOfDetail;
    }

    public get scale(): number {
        return this._view.scale;
    }
    public get centerXY(): ICartesian2 {
        return this._view.centerXY;
    }
    public get boundsXY(): IRectangle {
        return this._view.boundsXY;
    }

    public invalidateSize(w: number, h: number): ITileMapApi {
        this._view.invalidateSize(w, h);
        this._view.validate();
        return this;
    }
    public setView(center: IGeo2, zoom?: number, rotation?: number): ITileMapApi {
        this._view.setView(center, zoom, rotation);
        this._view.validate();
        return this;
    }
    public setZoom(zoom: number): ITileMapApi {
        this._view.setZoom(zoom);
        this._view.validate();
        return this;
    }
    public setAzimuth(r: number): ITileMapApi {
        this._view.setAzimuth(r);
        this._view.validate();
        return this;
    }
    public zoomIn(delta: number): ITileMapApi {
        this._view.zoomIn(delta ?? 1);
        this._view.validate();
        return this;
    }
    public zoomOut(delta: number): ITileMapApi {
        this._view.zoomOut(delta ?? 1);
        this._view.validate();
        return this;
    }
    public translate(tx: number, ty: number): ITileMapApi {
        this._view.translate(tx, ty);
        this._view.validate();
        return this;
    }
    public rotate(r: number): ITileMapApi {
        this._view.rotate(r);
        this._view.validate();
        return this;
    }

    public get display(): D {
        return this._display;
    }

    public get view(): TileMapView<V> {
        return this._view;
    }

    public get metrics(): ITileMetrics {
        return this.view.metrics;
    }

    public get azimuth(): number {
        return this._view.azimuth;
    }

    protected onUpdate(args: UpdateEventArgs<V>): void {
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

    protected onUpdateTiles(args: UpdateEventArgs<V>): void {
        // process tiles - process removed first lets framework doing some cleanup before allocating new tiles
        this.processRemoved(args);
        const allocated = this.processAdded(args);

        // invalidate only newly allocated tiles
        this.invalidateTiles(allocated, args.removed);
    }

    protected onUpdateView(args: UpdateEventArgs<V>): void {
        // update the view parameters
        this._lod = args.lod;
        this._scale = args.scale;
        this._center = args.center;

        // process tiles - process removed first lets framework doing some cleanup before allocating new tiles
        this.processRemoved(args);
        this.processAdded(args);

        // invalidate display
        this.invalidateDisplay();
    }

    public notifyRemovedObserver(tile: T) {
        if (this._removedObservable && this._removedObservable.hasObservers()) {
            this._removedObservable.notifyObservers(tile);
        }
    }
    public notifyUpdatedObserver(tile: T) {
        if (this._updatedObservable && this._updatedObservable.hasObservers()) {
            this._updatedObservable.notifyObservers(tile);
        }
    }
    public notifyAddedObserver(tile: T) {
        if (this._addedObservable && this._addedObservable.hasObservers()) {
            this._addedObservable.notifyObservers(tile);
        }
    }
    private processRemoved(args: UpdateEventArgs<V>): void {
        if (args.removed && args.removed.length != 0) {
            // this is the place to clean unactive tile
            for (const t of args.removed) {
                const key = t.address.quadkey;
                const old = this._activ.get(key);
                if (old) {
                    const mustDelete = true;

                    // this is where we may guess the reason it being removed
                    if (args.previousInfos) {
                        const lod = args.previousInfos.lod;
                        if (old.address.levelOfDetail != lod) {
                            // we changed level. We may keep the tile arround in order to
                            // allow the UI make a smooth transition
                            // Note the active tile are listening to the added and removed tile to update they neigbors, parent and child list.
                        }
                    }

                    if (mustDelete) {
                        this._activ.delete(key);
                        this.onDeleted(key, old);
                        this.notifyRemovedObserver(old);
                    }
                }
            }
        }
    }

    private processAdded(args: UpdateEventArgs<V>): Array<T> | undefined {
        if (args.added && args.added.length != 0) {
            const toDisplay: Array<T> = [];
            for (const t of args.added) {
                const key = t.address.quadkey;
                let t1 = this._activ.get(key);
                if (t1) {
                    // we update the tile
                    toDisplay.push(t1);
                    this.onUpdated(key, t1);
                    this.notifyUpdatedObserver(t1);
                    continue;
                }
                // we build and add a new map tile
                t1 = this.buildMapTile(t);
                toDisplay.push(t1);
                this._activ.set(key, t1);
                this.onAdded(key, t1);
                this.notifyAddedObserver(t1);
            }
            return toDisplay;
        }
        return undefined;
    }

    protected buildMapTile(t: ITile<V>): T {
        return <T>t;
    }

    protected onAddedObserverAdded(observer: Observer<T>): void {}
    protected onRemovedObserverAdded(observer: Observer<T>): void {}
    protected onUpdatedObserverAdded(observer: Observer<T>): void {}

    protected abstract onDeleted(key: string, tile: T): void;
    protected abstract onAdded(key: string, tile: T): void;
    protected abstract onUpdated(key: string, tile: T): void;
    protected abstract invalidateDisplay(): void;
    protected abstract invalidateTiles(added: Array<T> | undefined, removed: Array<ITile<V>> | undefined): void;
}
