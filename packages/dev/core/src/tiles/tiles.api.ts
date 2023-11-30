import { Geo2 } from "../geography/geography.position";
import { PropertyChangedEventArgs } from "../events/events.args";
import { Observable, Observer } from "../events/events.observable";
import { IEnvelope, IGeo2 } from "../geography/geography.interfaces";
import { ICartesian2, IRectangle, ISize2 } from "../geometry/geometry.interfaces";
import { ITileMetrics } from "./tiles.interfaces";
import { ITileMapApi } from "./tiles.interfaces.api";
import { Size2 } from "../geometry/geometry.size";
import { Scalar } from "../math/math";
import { IValidable } from "../types";
import { Cartesian2 } from "../geometry/geometry.cartesian";
import { Envelope, GeoBounded } from "../geography/geography.envelope";
import { Rectangle } from "../geometry/geometry.rectangle";
import { TileAddress } from "./tiles.address";

export class TileMapApiBase extends GeoBounded implements ITileMapApi, IValidable<TileMapApiBase> {
    /**
     * Keep an azimuth angle within the range of 0 to 360 degrees
     * @param a the azimuth value.
     * @returns the clampled value.
     */
    public static ClampAzimuth(a: number): number {
        // the modulo operator (%) is used to get the remainder when the azimuth is divided by 360.
        // Adding 360 to the result ensures that negative values are shifted into the positive range.
        // Finally, taking the modulo 360 of the sum ensures that values greater than 360 are wrapped
        // back to the range of 0 to 360.
        return ((a % 360) + 360) % 360;
    }

    _resizeObservable?: Observable<PropertyChangedEventArgs<ITileMapApi, ISize2>>;
    _centerObservable?: Observable<PropertyChangedEventArgs<ITileMapApi, IGeo2>>;
    _zoomObservable?: Observable<PropertyChangedEventArgs<ITileMapApi, number>>;
    _azimuthObservable?: Observable<PropertyChangedEventArgs<ITileMapApi, number>>;
    _viewChangedObservable?: Observable<ITileMapApi>;

    _metrics: ITileMetrics;

    // current navigation parameters
    _w: number;
    _h: number;
    _lodf: number;
    _lod: number;
    _bounds?: IEnvelope;
    _center: IGeo2;
    _azimuth: number;
    _cosangle: number;
    _sinangle: number;

    // interns
    _valid: boolean = false;
    _cartesianCache: ICartesian2; // used to avoid creating a new object each time we need to rotate a point
    _centerXY: ICartesian2;
    _scale: number;
    _boundsXY: IRectangle;

    public constructor(metrics: ITileMetrics, size?: ISize2, center?: IGeo2, lod?: number, azimuth?: number) {
        super();
        this._metrics = metrics;
        this._w = 0;
        this._h = 0;
        this._lodf = 0;
        this._lod = 0;
        this._center = Geo2.Zero();
        this._azimuth = 0;
        this._cosangle = 0;
        this._sinangle = 1;
        this._cartesianCache = Cartesian2.Zero();
        this._centerXY = Cartesian2.Zero();
        this._scale = 1;
        this._boundsXY = Rectangle.Zero();
        this.invalidateSize(size?.width ?? 0, size?.height ?? 0).setView(center ?? Geo2.Zero(), lod, azimuth);
    }

    /// VALIDABLE
    public get isValid(): boolean {
        return this._valid;
    }

    public invalidate(): TileMapApiBase {
        this._valid = false;
        return this;
    }

    public validate(): TileMapApiBase {
        if (!this._valid) {
            this._doValidateInternal();
            this._valid = true;
        }
        return this;
    }

    public revalidate(): TileMapApiBase {
        return this.invalidate().validate();
    }

    // MAP API
    public get center(): IGeo2 {
        return this._center;
    }

    public get zoom(): number {
        return this._lodf;
    }

    public get levelOfDetail(): number {
        return this._lod;
    }
    public get azimuth(): number {
        return this._azimuth;
    }

    public get scale(): number {
        return this._scale;
    }

    public get centerXY(): ICartesian2 {
        return this._centerXY;
    }

    public get boundsXY(): IRectangle {
        return this._boundsXY;
    }

    public get width(): number {
        return this._w;
    }

    public get height(): number {
        return this._h;
    }

    public get metrics(): ITileMetrics {
        return this._metrics;
    }

    public get resizeObservable(): Observable<PropertyChangedEventArgs<ITileMapApi, ISize2>> {
        this._resizeObservable = this._resizeObservable || new Observable<PropertyChangedEventArgs<ITileMapApi, ISize2>>(this._onResizeObserverAdded.bind(this));
        return this._resizeObservable;
    }

    public get centerObservable(): Observable<PropertyChangedEventArgs<ITileMapApi, IGeo2>> {
        this._centerObservable = this._centerObservable || new Observable<PropertyChangedEventArgs<ITileMapApi, IGeo2>>(this._onCenterObserverAdded.bind(this));
        return this._centerObservable;
    }

    public get zoomObservable(): Observable<PropertyChangedEventArgs<ITileMapApi, number>> {
        this._zoomObservable = this._zoomObservable || new Observable<PropertyChangedEventArgs<ITileMapApi, number>>(this._onZoomObserverAdded.bind(this));
        return this._zoomObservable;
    }

    public get azimuthObservable(): Observable<PropertyChangedEventArgs<ITileMapApi, number>> {
        this._azimuthObservable = this._azimuthObservable || new Observable<PropertyChangedEventArgs<ITileMapApi, number>>(this._onAzimuthObserverAdded.bind(this));
        return this._azimuthObservable;
    }

    public get viewChangedObservable(): Observable<ITileMapApi> {
        this._viewChangedObservable = this._viewChangedObservable || new Observable<ITileMapApi>(this._onViewChangedObserverAdded.bind(this));
        return this._viewChangedObservable;
    }

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

    public setView(center: IGeo2, zoom?: number | undefined, azimuth?: number | undefined): ITileMapApi {
        if (center && !this._center.equals(center)) {
            if (this._centerObservable && this._centerObservable.hasObservers()) {
                const old = this._center.clone();
                this._center.lat = center.lat;
                this._center.lon = center.lon;
                const e = new PropertyChangedEventArgs(this, old, center);
                this._centerObservable.notifyObservers(e);
                this.invalidate();
                return this;
            }
            this._center.lat = center.lat;
            this._center.lon = center.lon;
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
        const clamped = TileMapApiBase.ClampAzimuth(r);
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
            const p = this._rotatePointInv(tx, ty, this._cartesianCache);
            tx = p.x;
            ty = p.y;
        }
        const pixelCenterXY = this.metrics.getLatLonToPixelXY(this._center.lat, this._center.lon, this._lod);
        pixelCenterXY.x += tx;
        pixelCenterXY.y += ty;
        const center = this.metrics.getPixelXYToLatLon(pixelCenterXY.x, pixelCenterXY.y, this._lod);
        return this.setView(center);
    }

    public rotate(r: number): ITileMapApi {
        return this.setAzimuth(this._azimuth + r);
    }

    // INTERNALS
    protected _doValidateInternal() {
        this._beforeValidate();

        // set the metrics
        this._scale = TileAddress.GetLodScale(this._lodf);
        this._centerXY = this.metrics.getLatLonToPixelXY(this._center.lat, this._center.lon, this._lod);
        this._boundsXY = this._getRectangle(this._centerXY, this._scale);

        this._doValidate();

        // dispatch event
        if (this._viewChangedObservable && this._viewChangedObservable.hasObservers()) {
            this._viewChangedObservable.notifyObservers(this);
        }

        this._afterValidate();
    }

    protected _beforeValidate() {
        /* nothing to do here, may be override by subclass */
    }
    protected _doValidate() {
        /* nothing to do here, may be override by subclass */
    }
    protected _afterValidate() {
        /* nothing to do here, may be override by subclass */
    }

    protected _buildEnvelope(): IEnvelope | undefined {
        let rect = this._boundsXY;
        let nw = this.metrics.getPixelXYToLatLon(rect.xmin, rect.ymin, this._lod);
        let se = this.metrics.getPixelXYToLatLon(rect.xmax, rect.ymax, this._lod);
        return Envelope.FromPoints(nw, se);
    }

    protected _onResizeObserverAdded(observer: Observer<PropertyChangedEventArgs<ITileMapApi, ISize2>>): void {}
    protected _onZoomObserverAdded(observer: Observer<PropertyChangedEventArgs<ITileMapApi, number>>): void {}
    protected _onCenterObserverAdded(observer: Observer<PropertyChangedEventArgs<ITileMapApi, IGeo2>>): void {}
    protected _onAzimuthObserverAdded(observer: Observer<PropertyChangedEventArgs<ITileMapApi, number>>): void {}
    protected _onViewChangedObserverAdded(observer: Observer<ITileMapApi>): void {}

    private _rotatePointInv<R extends ICartesian2>(x: number, y: number, target?: R): R {
        const r = target || Cartesian2.Zero();
        r.x = x * this._cosangle + y * this._sinangle;
        r.y = -x * this._sinangle + y * this._cosangle;
        return <R>r;
    }

    private *_rotatePointsArround(center: ICartesian2, ...points: ICartesian2[]): IterableIterator<ICartesian2> {
        for (const p of points) {
            yield this._rotatePointArround(p.x, p.y, center);
        }
    }

    private _rotatePointArround<R extends ICartesian2>(x: number, y: number, center: ICartesian2, target?: R): R {
        const r = target || Cartesian2.Zero();
        const translatedX = x - center.x;
        const translatedY = y - center.y;
        r.x = translatedX * this._cosangle - translatedY * this._sinangle + center.x;
        r.y = translatedX * this._sinangle + translatedY * this._cosangle + center.y;
        return <R>r;
    }

    protected _getRectangle(center: ICartesian2, scale: number): IRectangle {
        const w = this.width / scale;
        const h = this.height / scale;
        const x0 = center.x - w / 2;
        const y0 = center.y - h / 2;
        let bounds = new Rectangle(x0, y0, w, h);

        if (this._azimuth) {
            const corners = bounds.points();
            const rotated = Array.from(this._rotatePointsArround(center, ...corners));
            bounds = Rectangle.FromPoints(...rotated);
            return bounds;
        }
        return bounds;
    }
}
