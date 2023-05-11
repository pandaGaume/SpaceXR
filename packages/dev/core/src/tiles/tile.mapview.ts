import { ICartesian2, IRectangle, ISize2 } from "../geometry/geometry.interfaces";
import { IGeo2 } from "../geography/geography.interfaces";
import { ITileMetrics, ITileMetricsProvider, ITileDirectory, ITileMapApi, ITile } from "./tiles.interfaces";
import { Geo2 } from "../geography/geography.position";
import { Observable, Observer } from "../events/events.observable";
import { EPSG3857 } from "./tiles.geography";
import { Cartesian2 } from "../geometry/geometry.cartesian";
import { Rectangle } from "../geometry/geometry.rectangle";
import { ObjectPool } from "../utils/objectpools";
import { IValidable } from "../types";
import { Scalar } from "core/math/math";

export class TileMapLevel<T> {
    _lod: number;
    _tiles: Map<string, ITile<T>>;
    _bounds?: IRectangle;
    constructor(lod: number) {
        this._lod = lod;
        this._tiles = new Map<string, ITile<T>>();
    }

    public get lod(): number {
        return this.lod;
    }

    public get tiles(): Map<string, ITile<T>> {
        return this._tiles;
    }

    public get bounds(): IRectangle | undefined {
        return this.bounds;
    }

    public set bounds(v: IRectangle | undefined) {
        this.bounds = v;
    }
}

export class UpdateEvent<T> {
    private static __pool__: any;

    public static Pool<T>(): ObjectPool<UpdateEvent<T>> {
        if (!UpdateEvent.__pool__) {
            UpdateEvent.__pool__ = new ObjectPool(UpdateEvent<T>);
        }
        return this.__pool__;
    }

    _scale: ICartesian2;
    _bounds: IRectangle;

    _added: Map<string, ITile<T>>;
    _removed: Map<string, ITile<T>>;

    public constructor() {
        this._scale = Cartesian2.One();
        this._bounds = Rectangle.Zero();
        this._added = new Map<string, ITile<T>>();
        this._removed = new Map<string, ITile<T>>();
    }

    public get from(): TileMapView<T> {
        return this.from;
    }

    public get scale(): ICartesian2 {
        return this._scale;
    }

    public set scale(v: ICartesian2) {
        this._scale = v;
    }

    public get bounds(): IRectangle {
        return this._bounds;
    }

    public set bounds(v: IRectangle) {
        this._bounds = v;
    }

    public get added(): Map<string, ITile<T>> {
        return this._added;
    }

    public get removed(): Map<string, ITile<T>> {
        return this._removed;
    }

    public clear() {
        this._scale = Cartesian2.One();
        this._bounds = Rectangle.Zero();
        this._added = new Map<string, ITile<T>>();
        this._removed = new Map<string, ITile<T>>();
    }
}

export class TileMapView<T> implements ITileMapApi, ISize2, ITileMetricsProvider, IValidable<TileMapView<T>> {
    // data source
    _d: ITileDirectory<T>;

    // current navigation parameters
    _w: number = 0;
    _h: number = 0;
    _center: IGeo2 = Geo2.Zero();
    _activTiles: Array<TileMapLevel<T>>;
    _lod: number = 0;

    // interns
    _valid: boolean = false;

    // event
    _resizeObservable?: Observable<TileMapView<T>>;
    _centerObservable?: Observable<TileMapView<T>>;
    _zoomObservable?: Observable<TileMapView<T>>;
    _updateObservable?: Observable<[TileMapView<T>, UpdateEvent<T>]>;

    public constructor(directory: ITileDirectory<T>, width: number, height: number, center: IGeo2, lod: number) {
        this._d = directory;
        this.invalidateSize(width, height).setView(center, lod);
        this._activTiles = new Array<TileMapLevel<T>>(this.metrics.maxLOD);
    }

    /// EVENTS
    public get resizeObservable(): Observable<TileMapView<T>> {
        this._resizeObservable == this._resizeObservable || new Observable<TileMapView<T>>(this.onResizeObserverAdded.bind(this));
        return this._resizeObservable!;
    }
    public get centerObservable(): Observable<TileMapView<T>> {
        this._centerObservable == this._centerObservable || new Observable<TileMapView<T>>(this.onCenterObserverAdded.bind(this));
        return this._centerObservable!;
    }
    public get zoomObservable(): Observable<TileMapView<T>> {
        this._zoomObservable == this._zoomObservable || new Observable<TileMapView<T>>(this.onZoomObserverAdded.bind(this));
        return this._zoomObservable!;
    }

    public get updateObservable(): Observable<[TileMapView<T>, UpdateEvent<T>]> {
        this._updateObservable == this._updateObservable || new Observable<[TileMapView<T>, UpdateEvent<T>]>(this.onUpdateObserverAdded.bind(this));
        return this._updateObservable!;
    }

    /// PROPERTIES
    public get directory(): ITileDirectory<T> {
        return this._d;
    }

    public get center(): IGeo2 {
        return this._center;
    }

    // METRICS PROVIDER
    public get metrics(): ITileMetrics {
        return this._d.metrics || EPSG3857.Shared;
    }

    // SIZE
    public get width(): number {
        return this._w;
    }

    public get height(): number {
        return this._h;
    }

    /// API
    public invalidateSize(w: number, h: number): ITileMapApi {
        if (this._w !== w || this._h != h) {
            this._w = w;
            this._h = h;
            if (this._resizeObservable && this._resizeObservable.hasObservers()) {
                this._resizeObservable.notifyObservers(this);
            }
            this.invalidate();
        }
        return this;
    }

    public setView(center: IGeo2, zoom?: number): ITileMapApi {
        if (center && !this.center.equals(center)) {
            this.center.lat = center.lat;
            this.center.lon = center.lon;
            if (this._centerObservable && this._centerObservable.hasObservers()) {
                this._centerObservable.notifyObservers(this);
            }
            this.invalidate();
        }
        return zoom ? this.setZoom(zoom) : this;
    }

    public setZoom(zoom: number): ITileMapApi {
        const lod = Scalar.Clamp(zoom, this.metrics.minLOD, this.metrics.maxLOD);
        if (this._lod != lod) {
            this._lod = lod;
            if (this._zoomObservable && this._zoomObservable.hasObservers()) {
                this._zoomObservable.notifyObservers(this);
            }
            this.invalidate();
        }
        return this;
    }

    public zoomIn(delta: number): ITileMapApi {
        return this.setZoom(this._lod + delta);
    }

    public zoomOut(delta: number): ITileMapApi {
        return this.setZoom(this._lod - delta);
    }

    public translate(tx: number, ty: number): ITileMapApi {
        const lod = Math.round(this._lod);
        const pixelCenterXY = this.metrics.getLatLonToPixelXY(this._center.lat, this._center.lon, lod);
        pixelCenterXY.x += tx;
        pixelCenterXY.y += ty;
        const center = this.metrics.getPixelXYToLatLon(pixelCenterXY.x, pixelCenterXY.y, lod);
        return this.setView(center);
    }

    /// VALIDABLE
    public get isValid(): boolean {
        return this._valid;
    }

    public invalidate(): TileMapView<T> {
        this._valid = false;
        return this;
    }

    public validate(): TileMapView<T> {
        if (!this._valid) {
            this.doValidate();
            this._valid = true;
        }
        return this;
    }

    // INTERNALS
    private onResizeObserverAdded(observer: Observer<TileMapView<T>>): void {}
    private onZoomObserverAdded(observer: Observer<TileMapView<T>>): void {}
    private onCenterObserverAdded(observer: Observer<TileMapView<T>>): void {}
    private onUpdateObserverAdded(observer: Observer<[TileMapView<T>, UpdateEvent<T>]>): void {}

    // VIRTUALS
    protected doValidate() {
        /*const lod = Math.round(this._lod);
        let lodOffset = (this._lod * 1000 - lod * 1000) / 1000; // Trick to avoid floating point error.
        let scale = lodOffset < 0 ? 1 + lodOffset / 2 : 1 + lodOffset;
        const w = this.width / scale;
        const h = this.height / scale;
        const pixelCenterXY = this.metrics.getLatLonToPixelXY(this._center.lat, this._center.lon, lod);
        const x0 = Math.round(pixelCenterXY.x - w / 2);
        const y0 = Math.round(pixelCenterXY.y - h / 2);
        const innerbounds = new Rectangle(x0, y0, w, h);
        const tileSize = this.metrics.tileSize * scale;
        const tileSize2 = tileSize * 2;
        const outerbounds = new Rectangle(x0 - tileSize, y0 - tileSize, w + tileSize2, h + tileSize2);*/
 
    }
}
