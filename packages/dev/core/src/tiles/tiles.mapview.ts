import { ICartesian2, IRectangle, ISize2 } from "../geometry/geometry.interfaces";
import { IEnvelope, IGeo2, IGeoBounded } from "../geography/geography.interfaces";
import { ITileMetrics, ITileMetricsProvider, ITileMapApi, ITile, ITileDatasource, ITileAddress } from "./tiles.interfaces";
import { Geo2 } from "../geography/geography.position";
import { Observable, Observer } from "../events/events.observable";
import { IValidable } from "../types";
import { Scalar } from "../math/math";
import { Size2 } from "../geometry/geometry.size";
import { EventArgs, PropertyChangedEventArgs } from "../events/events.args";
import { IMemoryCache, MemoryCache } from "../utils/cache";
import { Rectangle } from "../geometry/geometry.rectangle";
import { TileAddress } from "./tiles.address";
import { TileBuilder } from "./tiles";
import { TileMetrics } from "./tiles.metrics";
import { ContentUpdateEventArgs, TileContentManager } from "./tiles.content.manager";
import { Cartesian2 } from "../geometry/geometry.cartesian";
import { Envelope } from "../geography/geography.envelope";

export class TileMapContext<T> {
    _lod: number = 0;
    _scale: number = 1;
    _center: ICartesian2 = Cartesian2.Zero();
    _tiles: Map<string, ITile<T>> = new Map<string, ITile<T>>();

    public get lod(): number {
        return this._lod;
    }

    public get scale(): number {
        return this._scale;
    }

    public get tiles(): Map<string, ITile<T>> {
        return this._tiles;
    }

    public get size(): number {
        return this._tiles.size;
    }

    public get center(): ICartesian2 {
        return this._center;
    }
}

export enum UpdateReason {
    viewChanged,
    tileReady,
}

export class UpdateInfos {
    public constructor(public lod: number, public scale: number, public center: ICartesian2) {}
}

export class UpdateEventArgs<T> extends EventArgs<TileMapView<T>> {
    _reason: UpdateReason;
    _added?: Array<ITile<T>>;
    _removed?: Array<ITile<T>>;
    _previousInfos?: UpdateInfos;
    _infos: UpdateInfos;

    public constructor(source: TileMapView<T>, reason: UpdateReason, infos: UpdateInfos, oldInfos?: UpdateInfos, added?: Array<ITile<T>>, removed?: Array<ITile<T>>) {
        super(source);
        this._reason = reason;
        this._infos = infos;
        this._previousInfos = oldInfos;
        this._added = added;
        this._removed = removed;
    }

    public get reason(): UpdateReason {
        return this._reason;
    }

    public get added(): Array<ITile<T>> | undefined {
        return this._added;
    }

    public get removed(): Array<ITile<T>> | undefined {
        return this._removed;
    }

    public get infos(): UpdateInfos {
        return this._infos;
    }

    public get previousInfos(): UpdateInfos | undefined {
        return this._previousInfos;
    }

    public get lod(): number {
        return this._infos.lod;
    }
    public get scale(): number {
        return this._infos.scale;
    }
    public get center(): ICartesian2 {
        return this._infos.center;
    }
}

export enum LODTransitionMode {
    OFF = 0,
    LINEAR = 1,
}

export class TileMapView<T> implements ITileMapApi, ISize2, ITileMetricsProvider, IValidable<TileMapView<T>>, IGeoBounded {
    addedObservable: any;
    removedObservable: any;
    /**
     * Keep an azimuth angle within the range of 0 to 360 degrees
     * @param a the azimuth value
     * @returns the clampled value.
     */
    public static ClampAzimuth(a: number): number {
        // the modulo operator (%) is used to get the remainder when the azimuth is divided by 360.
        // Adding 360 to the result ensures that negative values are shifted into the positive range.
        // Finally, taking the modulo 360 of the sum ensures that values greater than 360 are wrapped
        // back to the range of 0 to 360.
        return ((a % 360) + 360) % 360;
    }

    // cache
    _cache: IMemoryCache<string, ITile<T>>;

    // data source
    _manager: TileContentManager<T>;

    // current navigation parameters
    _w: number = 0;
    _h: number = 0;
    _lod: number = 0;
    _bounds?: IEnvelope;
    _center: IGeo2 = Geo2.Zero();
    _context: TileMapContext<T>;
    _azimuth: number;
    _cosangle: number;
    _sinangle: number;

    // interns
    _oldInfos?: UpdateInfos;
    _valid: boolean = false;
    _cartesianCache: ICartesian2 = Cartesian2.Zero();
    _lodTransition: LODTransitionMode = LODTransitionMode.LINEAR;

    // event
    _resizeObservable?: Observable<PropertyChangedEventArgs<TileMapView<T>, ISize2>>;
    _centerObservable?: Observable<PropertyChangedEventArgs<TileMapView<T>, IGeo2>>;
    _zoomObservable?: Observable<PropertyChangedEventArgs<TileMapView<T>, number>>;
    _updateObservable?: Observable<UpdateEventArgs<T>>;

    public constructor(manager: TileContentManager<T>, width: number, height: number, center: IGeo2, lod: number, cache?: IMemoryCache<string, ITile<T>>) {
        this._cache = cache || new MemoryCache<string, ITile<T>>();
        this._manager = manager;
        this._manager.contentUpdateObservable.add(this.onTileContentUpdate.bind(this));
        this.invalidateSize(width, height).setView(center, lod);
        this._context = new TileMapContext<T>();
        this._azimuth = 0;
        this._cosangle = 0;
        this._sinangle = 1;
    }

    /// EVENTS
    public get resizeObservable(): Observable<PropertyChangedEventArgs<TileMapView<T>, ISize2>> {
        this._resizeObservable = this._resizeObservable || new Observable<PropertyChangedEventArgs<TileMapView<T>, ISize2>>(this.onResizeObserverAdded.bind(this));
        return this._resizeObservable!;
    }
    public get centerObservable(): Observable<PropertyChangedEventArgs<TileMapView<T>, IGeo2>> {
        this._centerObservable = this._centerObservable || new Observable<PropertyChangedEventArgs<TileMapView<T>, IGeo2>>(this.onCenterObserverAdded.bind(this));
        return this._centerObservable!;
    }
    public get zoomObservable(): Observable<PropertyChangedEventArgs<TileMapView<T>, number>> {
        this._zoomObservable = this._zoomObservable || new Observable<PropertyChangedEventArgs<TileMapView<T>, number>>(this.onZoomObserverAdded.bind(this));
        return this._zoomObservable!;
    }

    public get updateObservable(): Observable<UpdateEventArgs<T>> {
        this._updateObservable = this._updateObservable || new Observable<UpdateEventArgs<T>>(this.onUpdateObserverAdded.bind(this));
        return this._updateObservable!;
    }

    /// PROPERTIES
    public get bounds(): IEnvelope | undefined {
        return this.validateBounds();
    }

    public get datasource(): ITileDatasource<T, ITileAddress> {
        return this._manager.datasource;
    }

    public get context(): TileMapContext<T> {
        return this._context;
    }

    public get levelOfDetail(): number {
        return this._lod;
    }

    public get center(): IGeo2 {
        return this._center;
    }

    public get azimuth(): number {
        return this._azimuth;
    }

    // METRICS PROVIDER
    public get metrics(): ITileMetrics {
        return this.datasource.metrics;
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
            if (this._resizeObservable && this._resizeObservable.hasObservers()) {
                const old = new Size2(this._w, this._h);
                const value = new Size2(w, h);
                this._w = w;
                this._h = h;
                const e = new PropertyChangedEventArgs(this, old, value);
                this._resizeObservable.notifyObservers(e);
                this.invalidate();
                return this;
            }
            this._w = w;
            this._h = h;
            this.invalidate();
        }
        return this;
    }

    public setView(center: IGeo2, zoom?: number, azimuth?: number): ITileMapApi {
        if (center && !this.center.equals(center)) {
            if (this._centerObservable && this._centerObservable.hasObservers()) {
                const old = this._center.clone();
                this.center.lat = center.lat;
                this.center.lon = center.lon;
                const e = new PropertyChangedEventArgs(this, old, center);
                this._centerObservable.notifyObservers(e);
                this.invalidate();
                return this;
            }
            this.center.lat = center.lat;
            this.center.lon = center.lon;
            this.invalidate();
        }
        if (zoom) {
            this.setZoom(zoom);
        }
        if (azimuth) {
            this.setAzimuth(azimuth);
        }
        return this;
    }

    public setZoom(zoom: number): ITileMapApi {
        const lod = Scalar.Clamp(zoom, this.metrics.minLOD, this.metrics.maxLOD);
        if (this._lod != lod) {
            if (this._zoomObservable && this._zoomObservable.hasObservers()) {
                const old = this._lod;
                this._lod = lod;
                const e = new PropertyChangedEventArgs(this, old, zoom);
                this._zoomObservable.notifyObservers(e);
            } else {
                this._lod = lod;
            }
            this.invalidate();
        }
        return this;
    }

    public setAzimuth(r: number): ITileMapApi {
        this._azimuth = TileMapView.ClampAzimuth(r);
        const rad = this._azimuth * Scalar.DEG2RAD;
        this._cosangle = Math.cos(rad);
        this._sinangle = Math.sin(rad);
        this.invalidate();
        return this;
    }

    public zoomIn(delta: number): ITileMapApi {
        // ensure delta is positiv
        return this.setZoom(this._lod + Math.abs(delta));
    }

    public zoomOut(delta: number): ITileMapApi {
        // ensure delta is positiv
        return this.setZoom(this._lod - Math.abs(delta));
    }

    public translate(tx: number, ty: number): ITileMapApi {
        if (this._azimuth) {
            const p = this.rotatePointInv(tx, ty, this._cartesianCache);
            tx = p.x;
            ty = p.y;
        }
        const lod = Math.round(this._lod);
        const pixelCenterXY = this.metrics.getLatLonToPixelXY(this._center.lat, this._center.lon, lod);
        pixelCenterXY.x += tx;
        pixelCenterXY.y += ty;
        const center = this.metrics.getPixelXYToLatLon(pixelCenterXY.x, pixelCenterXY.y, lod);
        return this.setView(center);
    }

    public rotate(r: number): ITileMapApi {
        return this.setAzimuth(this._azimuth + r);
    }

    public validateBounds(): IEnvelope | undefined {
        if (!this._bounds) {
            let rect = this.getRectangle(this._context._center, this._context._scale);

            // compute the bounds of tile xy
            let nw = this.metrics.getPixelXYToLatLon(rect.xmin, rect.ymin, this._context._lod);
            let se = this.metrics.getPixelXYToLatLon(rect.xmax, rect.ymax, this._context._lod);

            this._bounds = Envelope.FromPoints(nw, se);
        }
        return this._bounds;
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

    public revalidate(): TileMapView<T> {
        return this.invalidate().validate();
    }

    // INTERNALS
    private onResizeObserverAdded(observer: Observer<PropertyChangedEventArgs<TileMapView<T>, ISize2>>): void {}
    private onZoomObserverAdded(observer: Observer<PropertyChangedEventArgs<TileMapView<T>, number>>): void {}
    private onCenterObserverAdded(observer: Observer<PropertyChangedEventArgs<TileMapView<T>, IGeo2>>): void {}
    private onUpdateObserverAdded(observer: Observer<UpdateEventArgs<T>>): void {}

    // VIRTUALS
    protected doValidate() {
        this._context._lod = Math.round(this.levelOfDetail);
        this.doValidateContext(this._context);
    }

    protected doValidateContext(level: TileMapContext<T>) {
        // current level of detail
        const lod = level.lod;
        // scale corresponding to the decimal part
        let scale = TileMetrics.GetLodScale(this.levelOfDetail);
        this._context._scale = scale;

        // compute the pixel bounds
        const pixelCenterXY = this.metrics.getLatLonToPixelXY(this._center.lat, this._center.lon, lod);
        this._context._center = pixelCenterXY;
        const rect = this.getRectangle(pixelCenterXY, scale);

        // compute the bounds of tile xy
        let nwTileXY = this.metrics.getPixelXYToTileXY(rect.xmin, rect.ymin);
        let seTileXY = this.metrics.getPixelXYToTileXY(rect.xmax, rect.ymax);

        const maxIndex = this.metrics.mapSize(lod) / this.metrics.tileSize - 1;
        const x0 = Math.max(0, nwTileXY.x);
        const y0 = Math.max(0, nwTileXY.y);
        const x1 = Math.min(maxIndex, seTileXY.x);
        const y1 = Math.min(maxIndex, seTileXY.y);

        const remains = new Array<ITile<T>>();
        let added = new Array<ITile<T>>();
        const builder = new TileBuilder<T>().withMetrics(this.metrics);

        for (let y = y0; y <= y1; y++) {
            for (let x = x0; x <= x1; x++) {
                const a = new TileAddress(x, y, lod);
                const key = a.quadkey;
                let t = level.tiles.get(key);
                if (t) {
                    remains.push(t);
                    // we delete to create the differential between remain, deleted and added.
                    level.tiles.delete(key);
                    continue;
                }
                // first have a look in cache
                t = this._cache.get(key);
                if (t) {
                    added.push(t);
                    continue;
                }

                // we need to create the tile.
                t = builder.withAddress(a).build();
                // set empty tile
                this._cache.set(key, t);

                // and retreive the content.
                // underlying operation will trigger the event to update observer
                const c = this._manager.getTileContent(a);
                if (c) {
                    t.content = [c];
                }
                added.push(t);
            }
        }

        let deleted = Array.from(level.tiles.values());
        level.tiles.clear();

        for (const t of remains) {
            level.tiles.set(t.address.quadkey, t);
        }
        for (const t of added) {
            level.tiles.set(t.address.quadkey, t);
        }

        // filter the tile, selecting only one with content.
        added = added.filter((t) => t.content !== undefined);
        deleted = deleted.filter((t) => t.content !== undefined);
        const newInfos = new UpdateInfos(this._context.lod, this._context.scale, this._context.center);

        const updateEvent = new UpdateEventArgs(this, UpdateReason.viewChanged, newInfos, this._oldInfos, added.length ? added : undefined, deleted.length ? deleted : undefined);
        this._oldInfos = newInfos;
        this.updateObservable.notifyObservers(updateEvent);
    }

    protected onTileContentUpdate(args: ContentUpdateEventArgs<T>): void {
        let t: ITile<T> | undefined;
        t = this._cache.get(args.address.quadkey);
        if (t) {
            if (args.content) {
                t.content = [args.content];
                // we have the content of the tile.
                this.onTileReady(t);
                return;
            }
            // the content is not defined.
            this.onTileNotFound(t);
        }
    }

    /**
     * This is the place to add the tile to the active list in response to a successful content load.
     * @param t the new tile with a valid content
     */
    private onTileReady(t: ITile<T>) {
        if (t.address.levelOfDetail == this._context.lod) {
            this._context.tiles.set(t.address.quadkey, t);
            const added = [t];
            const newInfos = new UpdateInfos(this._context.lod, this._context.scale, this._context.center);
            const updateEvent = new UpdateEventArgs(this, UpdateReason.tileReady, newInfos, this._oldInfos, added);
            this._oldInfos = newInfos;
            this.updateObservable.notifyObservers(updateEvent);
        }
    }

    protected onTileNotFound(t: ITile<T>) {
        console.log("tile not found", t.address);
        t.content = null;
    }

    private *rotatePointsArround(center: ICartesian2, ...points: ICartesian2[]): IterableIterator<ICartesian2> {
        for (const p of points) {
            yield this.rotatePointArround(p.x, p.y, center);
        }
    }

    private rotatePointInv<R extends ICartesian2>(x: number, y: number, target?: R): R {
        const r = target || Cartesian2.Zero();
        r.x = x * this._cosangle + y * this._sinangle;
        r.y = -x * this._sinangle + y * this._cosangle;
        return <R>r;
    }

    private rotatePointArround<R extends ICartesian2>(x: number, y: number, center: ICartesian2, target?: R): R {
        const r = target || Cartesian2.Zero();
        const translatedX = x - center.x;
        const translatedY = y - center.y;
        r.x = translatedX * this._cosangle - translatedY * this._sinangle + center.x;
        r.y = translatedX * this._sinangle + translatedY * this._cosangle + center.y;
        return <R>r;
    }

    private getRectangle(center: ICartesian2, scale: number): IRectangle {
        const w = this.width / scale;
        const h = this.height / scale;
        const x0 = center.x - w / 2;
        const y0 = center.y - h / 2;
        let bounds = new Rectangle(x0, y0, w, h);

        if (this._azimuth) {
            const corners = bounds.points();
            const rotated = Array.from(this.rotatePointsArround(center, ...corners));
            bounds = Rectangle.FromPoints(...rotated);
            return bounds;
        }
        return bounds;
    }
}
