import { ICartesian2, ISize2 } from "../geometry/geometry.interfaces";
import { IEnvelope, IGeo2, IGeoBounded } from "../geography/geography.interfaces";
import { ITileMetrics, ITileMetricsProvider, ITileMapApi, ITile, ITileDatasource, ITileAddress, FetchResult } from "./tiles.interfaces";
import { Geo2 } from "../geography/geography.position";
import { Observable, Observer } from "../events/events.observable";
import { EPSG3857 } from "./tiles.geography";
import { IValidable, Nullable } from "../types";
import { Scalar } from "../math/math";
import { Size2 } from "../geometry/geometry.size";
import { EventArgs, PropertyChangedEventArgs } from "../events/events.args";
import { IMemoryCache, MemoryCache } from "../utils/cache";
import { Rectangle } from "../geometry/geometry.rectangle";
import { TileAddress } from "./tiles.address";
import { TileBuilder } from "./tiles";
import { TileMetrics } from "./tiles.metrics";
import { Cartesian2, Envelope } from "..";

export class TileMapLevel<T> {
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

export class UpdateEventArgs<T> extends EventArgs<TileMapView<T>> {
    _reason: UpdateReason;
    _added?: Array<ITile<T>>;
    _removed?: Array<ITile<T>>;
    _lod: number;
    _scale: number;
    _center: ICartesian2;

    public constructor(source: TileMapView<T>, reason: UpdateReason, lod: number, scale: number, center: ICartesian2, added?: Array<ITile<T>>, removed?: Array<ITile<T>>) {
        super(source);
        this._reason = reason;
        this._lod = lod;
        this._scale = scale;
        this._center = center;
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

    public get lod(): number {
        return this._lod;
    }
    public get scale(): number {
        return this._scale;
    }
    public get center(): ICartesian2 {
        return this._center;
    }
}

export class TileMapView<T> implements ITileMapApi, ISize2, ITileMetricsProvider, IValidable<TileMapView<T>>, IGeoBounded {
    // cache
    _cache: IMemoryCache<string, ITile<T>>;

    // data source
    _datasource: ITileDatasource<T, ITileAddress>;
    _metrics: ITileMetrics;

    // current navigation parameters
    _w: number = 0;
    _h: number = 0;
    _lod: number = 0;
    _bounds?: IEnvelope;
    _center: IGeo2 = Geo2.Zero();
    _level: TileMapLevel<T>;
    _rotation: number;
    _cosangle: number;
    _sinangle: number;

    // interns
    _valid: boolean = false;

    // event
    _resizeObservable?: Observable<PropertyChangedEventArgs<TileMapView<T>, ISize2>>;
    _centerObservable?: Observable<PropertyChangedEventArgs<TileMapView<T>, IGeo2>>;
    _zoomObservable?: Observable<PropertyChangedEventArgs<TileMapView<T>, number>>;
    _updateObservable?: Observable<UpdateEventArgs<T>>;

    public constructor(
        datasource: ITileDatasource<T, ITileAddress>,
        metrics: ITileMetrics,
        width: number,
        height: number,
        center: IGeo2,
        lod: number,
        cache?: IMemoryCache<string, ITile<T>>
    ) {
        this._cache = cache || new MemoryCache<string, ITile<T>>();
        this._datasource = datasource;
        this._metrics = metrics || EPSG3857.Shared;
        this.invalidateSize(width, height).setView(center, lod);
        this._level = new TileMapLevel<T>();
        this._rotation = 0;
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
        return this._datasource;
    }

    public get level(): TileMapLevel<T> {
        return this._level;
    }

    public get levelOfDetail(): number {
        return this._lod;
    }

    public get center(): IGeo2 {
        return this._center;
    }

    public get rotation(): number {
        return this._rotation;
    }

    // METRICS PROVIDER
    public get metrics(): ITileMetrics {
        return this._metrics;
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

    public setView(center: IGeo2, zoom?: number, rotation?: number): ITileMapApi {
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
        if (rotation) {
            this.setRotation(rotation);
        }
        return this;
    }

    public setZoom(zoom: number): ITileMapApi {
        const lod = Scalar.Clamp(zoom, this.metrics.minLOD, this.metrics.maxLOD);
        if (this.levelOfDetail != lod) {
            if (this._zoomObservable && this._zoomObservable.hasObservers()) {
                const old = this._lod;
                this._lod = lod;
                const e = new PropertyChangedEventArgs(this, old, zoom);
                this._zoomObservable.notifyObservers(e);
                this.invalidate();
                return this;
            }
            this._lod = lod;
            this.invalidate();
        }
        return this;
    }

    public setRotation(r: number): ITileMapApi {
        // ensure r is [360, 360]
        const r0 = r % 360;
        this._rotation = r0 < 0 ? 360 + r0 : r0;
        const rad = this._rotation * Scalar.DEG2RAD;
        this._cosangle = Math.cos(rad);
        this._sinangle = Math.sin(rad);
        this.invalidate();
        return this;
    }

    public zoomIn(delta: number): ITileMapApi {
        // ensure delta is positiv
        return this.setZoom(this.levelOfDetail + Math.abs(delta));
    }

    public zoomOut(delta: number): ITileMapApi {
        // ensure delta is positiv
        return this.setZoom(this.levelOfDetail - Math.abs(delta));
    }

    public translate(tx: number, ty: number): ITileMapApi {
        if (this._rotation) {
            const p = this.rotatePoint(tx, ty);
            tx = p.x;
            ty = p.y;
        }
        const lod = Math.round(this.levelOfDetail);
        const pixelCenterXY = this.metrics.getLatLonToPixelXY(this._center.lat, this._center.lon, lod);
        pixelCenterXY.x += tx;
        pixelCenterXY.y += ty;
        const center = this.metrics.getPixelXYToLatLon(pixelCenterXY.x, pixelCenterXY.y, lod);
        return this.setView(center);
    }

    public rotate(r: number): ITileMapApi {
        return this.setRotation(this._rotation + r);
    }

    public validateBounds(): IEnvelope | undefined {
        if (!this._bounds) {
            const c = this._level._center;

            const w = this.width / this._level._scale;
            const h = this.height / this._level._scale;
            let x0 = c.x - w / 2;
            let y0 = c.y - h / 2;
            let bounds = new Rectangle(x0, y0, w, h);
            if (this._rotation) {
                const corners = bounds.points();
                const rotated = Array.from(this.rotatePoints(bounds.center, ...corners));
                bounds = Rectangle.FromPoints(...rotated);
            }

            // compute the bounds of tile xy
            let nwTileXY = this.metrics.getPixelXYToLatLon(bounds.left, bounds.top, this._level._lod);
            let seTileXY = this.metrics.getPixelXYToLatLon(bounds.right, bounds.bottom, this._level._lod);

            this._bounds = Envelope.FromPoints(nwTileXY, seTileXY);
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
        this._level._lod = Math.round(this.levelOfDetail);
        this.doValidateLevel(this._level);
    }

    protected doValidateLevel(level: TileMapLevel<T>) {
        // current level of detail
        const lod = level.lod;
        // scale corresponding to the decimal part
        let scale = TileMetrics.GetScale(this.levelOfDetail);
        this._level._scale = scale;

        // compute the pixel bounds
        const pixelCenterXY = this.metrics.getLatLonToPixelXY(this._center.lat, this._center.lon, lod);
        this._level._center = pixelCenterXY;

        const w = this.width / scale;
        const h = this.height / scale;
        let x0 = Math.round(pixelCenterXY.x - w / 2);
        let y0 = Math.round(pixelCenterXY.y - h / 2);
        let bounds = new Rectangle(x0, y0, w, h);
        if (this._rotation) {
            const corners = bounds.points();
            const rotated = Array.from(this.rotatePoints(bounds.center, ...corners));
            bounds = Rectangle.FromPoints(...rotated);
        }

        // compute the bounds of tile xy
        let nwTileXY = this.metrics.getPixelXYToTileXY(bounds.left, bounds.top);
        let seTileXY = this.metrics.getPixelXYToTileXY(bounds.right, bounds.bottom);
        const tileXYBounds = Rectangle.FromPoints(nwTileXY, seTileXY);

        x0 = tileXYBounds.left;
        y0 = tileXYBounds.bottom;
        const x1 = tileXYBounds.right;
        const y1 = tileXYBounds.top;

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
                this._cache.set(key, t);
                // and retreive the content.
                this._datasource
                    .fetchAsync(a, this, t)
                    .then((result: FetchResult<Nullable<T>>) => {
                        const view = <TileMapView<T>>result.userArgs[0];
                        const t = <ITile<T>>result.userArgs[1];
                        if (result.content) {
                            // we have the content of the tile.
                            t.content = result.content;
                            view.onTileReady(t);
                            return;
                        }
                        // the content is not defined.
                        view.onTileNotFound(t);
                    })
                    .catch((reason: any) => {
                        // the lookup operation has failed - TODO describe a strategy
                    });
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

        // filter the tile, selecting only one with content. Null is consider as content.
        added = added.filter((t) => t.content !== undefined && t.content !== null);
        deleted = deleted.filter((t) => t.content !== undefined && t.content !== null);

        const updateEvent = new UpdateEventArgs(
            this,
            UpdateReason.viewChanged,
            this._level.lod,
            this._level.scale,
            this._level.center,
            added.length ? added : undefined,
            deleted.length ? deleted : undefined
        );
        this.updateObservable.notifyObservers(updateEvent);
    }

    /**
     * This is the place to add the tile to the active list in response to a successful content load.
     * Additionally, we should also check if any parents or children are no longer being utilized.
     * This includes parents or children that was used to provide alternative content while asynchronously loading the current tile content.
     * @param t the new tile with a valid content
     */
    private onTileReady(t: ITile<T>) {
        if (t.address.levelOfDetail == this._level.lod) {
            this._level.tiles.set(t.address.quadkey, t);
            const added = [t];
            const updateEvent = new UpdateEventArgs(this, UpdateReason.tileReady, this._level.lod, this._level.scale, this._level.center, added);
            this.updateObservable.notifyObservers(updateEvent);
        }
    }

    protected onTileNotFound(t: ITile<T>) {
        console.log("tile not found", t.address);
        t.content = null;
    }

    public *rotatePoints(center: ICartesian2, ...points: ICartesian2[]): IterableIterator<ICartesian2> {
        for (const p of points) {
            yield this.rotatePoint(p.x, p.y, center);
        }
    }

    /**
     * Rotate point arround optional center, with reference of azimuth zero up to the North
     * and clockwise rotation / counter clockwize depending the inv parameter
     */
    public rotatePoint<R extends ICartesian2>(x: number, y: number, center?: ICartesian2, target?: R, inv = false): R {
        const translatedX = center ? x - center.x : x;
        const translatedY = center ? y - center.y : y;

        const rotatedX = translatedX * this._cosangle + (inv ? translatedY * -this._sinangle : translatedY * this._sinangle);
        const rotatedY = translatedY * this._cosangle - (inv ? translatedX * -this._sinangle : translatedX * this._sinangle);

        const r = target || Cartesian2.Zero();
        r.x = center ? rotatedX + center.x : rotatedX;
        r.y = center ? rotatedY + center.y : rotatedY;
        return <R>r;
    }
}
