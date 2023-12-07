import { ICartesian2, IRectangle, ISize2 } from "../geometry/geometry.interfaces";
import { IEnvelope, IGeo2, IGeoBounded } from "../geography/geography.interfaces";
import { ITileMetrics, ITileMetricsProvider, ITile } from "./tiles.interfaces";
import { ITileContentProvider } from "./pipeline/tiles.pipeline.interfaces";
import { ITileMapApi } from "./map/tiles.api.interfaces";
import { Geo2 } from "../geography/geography.position";
import { Observable, Observer } from "../events/events.observable";
import { IValidable, Nullable } from "../types";
import { Scalar } from "../math/math";
import { Size2 } from "../geometry/geometry.size";
import { EventArgs, PropertyChangedEventArgs } from "../events/events.args";
import { IMemoryCache, MemoryCache } from "../utils/cache";
import { Rectangle } from "../geometry/geometry.rectangle";
import { TileAddress } from "./tiles.address";
import { TileBuilder } from "./tiles";
import { Cartesian2 } from "../geometry/geometry.cartesian";
import { Envelope } from "../geography/geography.envelope";

export interface IContextMetrics {
    lod: number;
    scale: number;
    center: ICartesian2;
}

export class TileMapContext<T> implements IContextMetrics {
    _lod: number;
    _scale: number = 1;
    _center: ICartesian2 = Cartesian2.Zero();
    _tiles: Map<string, ITile<T>>;
    _rect: IRectangle = Rectangle.Zero();

    public constructor(lod?: number) {
        this._lod = lod || 0;
        this._scale = 1;
        this._center = Cartesian2.Zero();
        this._tiles = new Map<string, ITile<T>>();
    }

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

    public get rect(): IRectangle {
        return this._rect;
    }

    public clear(): void {
        this._tiles.clear();
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
    _previousInfos?: IContextMetrics;
    _infos: IContextMetrics;

    public constructor(source: TileMapView<T>, reason: UpdateReason, infos: IContextMetrics, oldInfos?: IContextMetrics, added?: Array<ITile<T>>, removed?: Array<ITile<T>>) {
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

    public get infos(): IContextMetrics {
        return this._infos;
    }

    public get previousInfos(): IContextMetrics | undefined {
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

/// @deprecated
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
    _contentProvider: ITileContentProvider<T>;

    // current navigation parameters
    _w: number = 0;
    _h: number = 0;
    _lodf: number = 0;
    _lod: number = 0;
    _bounds?: IEnvelope;
    _center: IGeo2 = Geo2.Zero();

    // the list of context will may serve as cache, and prepare transition between LOD.
    _contexts: Array<TileMapContext<T>>;
    _currentContext: TileMapContext<T>;
    // not used yet.
    _cacheUpperLOD: boolean = false;
    _cacheLowerLOD: boolean = false;

    _azimuth: number;
    _cosangle: number;
    _sinangle: number;

    // interns
    _valid: boolean = false;
    _cartesianCache: ICartesian2 = Cartesian2.Zero();

    // event
    _resizeObservable?: Observable<PropertyChangedEventArgs<ITileMapApi, ISize2>>;
    _centerObservable?: Observable<PropertyChangedEventArgs<ITileMapApi, IGeo2>>;
    _zoomObservable?: Observable<PropertyChangedEventArgs<ITileMapApi, number>>;
    _azimuthObservable?: Observable<PropertyChangedEventArgs<ITileMapApi, number>>;
    _updateObservable?: Observable<UpdateEventArgs<T>>;
    _viewChangedObservable?: Observable<ITileMapApi>;

    public constructor(contentProvider: ITileContentProvider<T>, width: number, height: number, center: IGeo2, lod: number, cache?: IMemoryCache<string, ITile<T>>) {
        this._cache = cache || new MemoryCache<string, ITile<T>>();
        this._contentProvider = contentProvider;
        this._contentProvider.contentUpdateObservable.add(this.onTileContentUpdate.bind(this));
        this._currentContext = new TileMapContext<T>(-1); // initialize with -1 to force context switch
        // note : The map method alone will not iterate over the holes created by the arry constructor.
        // So we use the spread operator to first convert these holes into undefined values, and then use map.
        this._contexts = [...new Array<TileMapContext<T>>(this.metrics.lodCount)].map((o, i) => new TileMapContext<T>(i + this.metrics.minLOD));
        this.invalidateSize(width, height).setView(center, TileAddress.ClampLod(lod, this.metrics));
        this._azimuth = 0;
        this._cosangle = 0;
        this._sinangle = 1;
    }

    /// EVENTS
    public get resizeObservable(): Observable<PropertyChangedEventArgs<ITileMapApi, ISize2>> {
        this._resizeObservable = this._resizeObservable || new Observable<PropertyChangedEventArgs<ITileMapApi, ISize2>>(this.onResizeObserverAdded.bind(this));
        return this._resizeObservable!;
    }
    public get centerObservable(): Observable<PropertyChangedEventArgs<ITileMapApi, IGeo2>> {
        this._centerObservable = this._centerObservable || new Observable<PropertyChangedEventArgs<ITileMapApi, IGeo2>>(this.onCenterObserverAdded.bind(this));
        return this._centerObservable!;
    }
    public get zoomObservable(): Observable<PropertyChangedEventArgs<ITileMapApi, number>> {
        this._zoomObservable = this._zoomObservable || new Observable<PropertyChangedEventArgs<ITileMapApi, number>>(this.onZoomObserverAdded.bind(this));
        return this._zoomObservable!;
    }
    public get azimuthObservable(): Observable<PropertyChangedEventArgs<ITileMapApi, number>> {
        this._azimuthObservable = this._azimuthObservable || new Observable<PropertyChangedEventArgs<ITileMapApi, number>>(this.onAzimuthObserverAdded.bind(this));
        return this._azimuthObservable!;
    }

    public get updateObservable(): Observable<UpdateEventArgs<T>> {
        this._updateObservable = this._updateObservable || new Observable<UpdateEventArgs<T>>(this.onUpdateObserverAdded.bind(this));
        return this._updateObservable!;
    }

    public get viewChangedObservable(): Observable<ITileMapApi> {
        this._viewChangedObservable = this._viewChangedObservable || new Observable<ITileMapApi>();
        return this._viewChangedObservable!;
    }

    /// PROPERTIES

    public get zoom(): number {
        return this._lodf;
    }

    public get scale(): number {
        return this._currentContext._scale;
    }

    public get centerXY(): ICartesian2 {
        return this._currentContext._center;
    }

    public get boundsXY(): IRectangle {
        return this._currentContext._rect;
    }

    public get bounds(): IEnvelope | undefined {
        return this.validateBounds();
    }

    public get contentProvider(): ITileContentProvider<T> {
        return this._contentProvider;
    }

    public get context(): TileMapContext<T> {
        return this._currentContext;
    }

    public get levelOfDetail(): number {
        return this._lodf;
    }

    public get center(): IGeo2 {
        return this._center;
    }

    public get azimuth(): number {
        return this._azimuth;
    }

    // METRICS PROVIDER
    public get metrics(): ITileMetrics {
        return this.contentProvider.metrics;
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
        const lodf = Scalar.Clamp(zoom, this.metrics.minLOD, this.metrics.maxLOD);
        if (this._lodf != lodf) {
            const old = this._lodf;
            this._lodf = lodf;
            this._lod = Math.round(this._lodf);
            if (this._zoomObservable && this._zoomObservable.hasObservers()) {
                const e = new PropertyChangedEventArgs(this, old, zoom);
                this._zoomObservable.notifyObservers(e);
            }
            this.invalidate();
        }
        return this;
    }

    public setAzimuth(r: number): ITileMapApi {
        const clamped = TileMapView.ClampAzimuth(r);
        if (this._azimuth != clamped) {
            const old = this._azimuth;
            this._azimuth = clamped;
            const rad = this._azimuth * Scalar.DEG2RAD;
            this._cosangle = Math.cos(rad);
            this._sinangle = Math.sin(rad);
            if (this._azimuthObservable && this._azimuthObservable.hasObservers()) {
                const e = new PropertyChangedEventArgs(this, old, clamped);
                this._azimuthObservable.notifyObservers(e);
            }
            this.invalidate();
        }
        return this;
    }

    public zoomIn(delta: number): ITileMapApi {
        // ensure delta is positiv
        return this.setZoom(this._lodf + Math.abs(delta));
    }

    public zoomOut(delta: number): ITileMapApi {
        // ensure delta is positiv
        return this.setZoom(this._lodf - Math.abs(delta));
    }

    public translate(tx: number, ty: number): ITileMapApi {
        if (this._azimuth) {
            const p = this.rotatePointInv(tx, ty, this._cartesianCache);
            tx = p.x;
            ty = p.y;
        }
        const lod = Math.round(this._lodf);
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
            let rect = this.getRectangle(this._currentContext._center, this._currentContext._scale);

            // compute the bounds of tile xy
            let nw = this.metrics.getPixelXYToLatLon(rect.xmin, rect.ymin, this._currentContext._lod);
            let se = this.metrics.getPixelXYToLatLon(rect.xmax, rect.ymax, this._currentContext._lod);

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
    private _getContext(lod: number): Nullable<TileMapContext<T>> {
        if (TileAddress.IsValidLod(lod, this.metrics)) {
            return this._contexts[lod - this.metrics.minLOD];
        }
        return null;
    }

    private onResizeObserverAdded(observer: Observer<PropertyChangedEventArgs<ITileMapApi, ISize2>>): void {}
    private onZoomObserverAdded(observer: Observer<PropertyChangedEventArgs<ITileMapApi, number>>): void {}
    private onCenterObserverAdded(observer: Observer<PropertyChangedEventArgs<ITileMapApi, IGeo2>>): void {}
    private onAzimuthObserverAdded(observer: Observer<PropertyChangedEventArgs<ITileMapApi, number>>): void {}
    private onUpdateObserverAdded(observer: Observer<UpdateEventArgs<T>>): void {}

    // VIRTUALS
    protected doValidate() {
        if (this._cacheLowerLOD || this._cacheUpperLOD) {
            return this.doValidateWithCache();
        }
        // we have this._lod which is the current level of detail
        // we have this._lodf which is the current level of detail with decimal part
        // we have this._currentContext which is the current context
        // we have this._currentContext._lod which is the current level of detail of the current context
        // so if the current level of detail is different from the current context level of detail, we have to change the context.
        // Additionally, we may clean the previous context.
        if (this._lod != this._currentContext._lod) {
            // we have to switch context. Note that reach this point, the lod is already in range and valid.
            const newContext = this._getContext(this._lod)!;
            const oldContext = this._currentContext;
            // we may clear the previous context if we do not cache the upper or lower level of detail.
            this.doClearContext(oldContext, newContext);
            // we assign the new context
            this._currentContext = newContext;
            // we validate the new context
            this.doValidateContext(oldContext, newContext);
            return;
        }
        this.doValidateContext(this._currentContext, this._currentContext);
    }

    protected doValidateWithCache() {
        // not implemented yet.
    }

    protected doClearContext(oldLevel: TileMapContext<T>, newLevel: TileMapContext<T>): void {
        let deleted = Array.from(oldLevel.tiles.values());
        oldLevel.tiles.clear();

        // filter the tile, selecting only ones with content.
        deleted = deleted.filter((t) => t.content !== undefined);
        const updateEvent = new UpdateEventArgs(this, UpdateReason.viewChanged, newLevel, oldLevel, undefined, deleted.length ? deleted : undefined);
        this.updateObservable.notifyObservers(updateEvent);
    }

    protected async doValidateContext(oldLevel: TileMapContext<T>, newLevel: Nullable<TileMapContext<T>>, dispatchEvent: boolean = true) {
        if (newLevel == null) {
            return;
        }
        // current level of detail
        const contextLod = newLevel._lod;

        // scale corresponding to the decimal part
        let scale = TileAddress.GetLodScale(this._lodf);
        newLevel._scale = scale;

        // compute the pixel bounds
        const pixelCenterXY = this.metrics.getLatLonToPixelXY(this._center.lat, this._center.lon, contextLod);
        newLevel._center = pixelCenterXY;
        const rect = this.getRectangle(pixelCenterXY, scale);
        newLevel._rect = rect;

        // compute the bounds of tile xy
        let nwTileXY = this.metrics.getPixelXYToTileXY(rect.xmin, rect.ymin);
        let seTileXY = this.metrics.getPixelXYToTileXY(rect.xmax, rect.ymax);

        const maxIndex = this.metrics.mapSize(contextLod) / this.metrics.tileSize - 1;
        const x0 = Math.max(0, nwTileXY.x);
        const y0 = Math.max(0, nwTileXY.y);
        const x1 = Math.min(maxIndex, seTileXY.x);
        const y1 = Math.min(maxIndex, seTileXY.y);

        const remains = new Array<ITile<T>>();
        let added = new Array<ITile<T>>();
        const builder = new TileBuilder<T>().withMetrics(this.metrics);

        for (let y = y0; y <= y1; y++) {
            for (let x = x0; x <= x1; x++) {
                const a = new TileAddress(x, y, contextLod);
                const key = a.quadkey;
                let t = newLevel.tiles.get(key);
                if (t) {
                    remains.push(t);
                    // we delete to create the differential between remain, deleted and added.
                    newLevel.tiles.delete(key);
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
                t.content = await this._contentProvider.fetchContentAsync(a);
                added.push(t);
            }
        }

        let deleted = Array.from(newLevel.tiles.values());
        newLevel.tiles.clear();

        for (const t of remains) {
            newLevel.tiles.set(t.address.quadkey, t);
        }
        for (const t of added) {
            newLevel.tiles.set(t.address.quadkey, t);
        }

        if (dispatchEvent) {
            // filter the tile, selecting only ones with content.
            added = added.filter((t) => t.content !== undefined);
            deleted = deleted.filter((t) => t.content !== undefined);
            const updateEvent = new UpdateEventArgs(this, UpdateReason.viewChanged, newLevel, oldLevel, added.length ? added : undefined, deleted.length ? deleted : undefined);
            this.updateObservable.notifyObservers(updateEvent);
        }
    }

    protected onTileContentUpdate(args: ContentUpdateEventArgs<T>): void {
        let t: ITile<T> | undefined;
        t = this._cache.get(args.address.quadkey);
        if (t) {
            if (args.content) {
                t.content = args.content;
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
        if (t.address.levelOfDetail == this._currentContext.lod) {
            this._currentContext.tiles.set(t.address.quadkey, t);
            const added = [t];
            const updateEvent = new UpdateEventArgs(this, UpdateReason.tileReady, this._currentContext, this._currentContext, added);
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
