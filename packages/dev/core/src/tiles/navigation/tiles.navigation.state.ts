import { IGeo2, IsLocation } from "../../geography/geography.interfaces";
import { PropertyChangedEventArgs } from "../../events/events.args";
import { Observable } from "../../events/events.observable";
import { ITileNavigationState } from "./tiles.navigation.interfaces";
import { Geo2 } from "../../geography/geography.position";
import { ValidableBase } from "../../types";
import { ITileMetrics } from "../tiles.interfaces";
import { ICartesian2 } from "../../geometry/geometry.interfaces";
import { Cartesian2 } from "../../geometry/geometry.cartesian";
import { Bearing } from "../../geography/geography.bearing";
import { TileAddress } from "../address/tiles.address";
import { EPSG3857 } from "../geography";

export class TileNavigationState extends ValidableBase implements ITileNavigationState {
    _centerObservable?: Observable<PropertyChangedEventArgs<ITileNavigationState, IGeo2>>;
    _zoomObservable?: Observable<PropertyChangedEventArgs<ITileNavigationState, number>>;
    _azimuthObservable?: Observable<PropertyChangedEventArgs<ITileNavigationState, Bearing>>;
    _stateChangedObservable?: Observable<ITileNavigationState>;

    _lodf: number;
    _center: IGeo2;
    _azimuth: Bearing;

    // internal
    _cartesianCache: ICartesian2 = Cartesian2.Zero();

    public constructor(metrics: ITileMetrics, center?: IGeo2, lod?: number, azimuth?: number) {
        super();
        this._lodf = 0;
        this._center = Geo2.Zero();
        this._azimuth = new Bearing(azimuth ?? 0);
    }

    public get lod(): number {
        return Math.round(this._lodf);
    }

    public get scale(): number {
        return TileAddress.GetLodScale(this._lodf);
    }

    public get center(): IGeo2 {
        return this._center;
    }

    public set center(center: IGeo2) {
        if (center && !this._center.equals(center)) {
            if (this._centerObservable && this._centerObservable.hasObservers()) {
                const old = this._center.clone();
                this._center.lat = center.lat;
                this._center.lon = center.lon;
                const e = new PropertyChangedEventArgs(this, old, center);
                this._centerObservable.notifyObservers(e);
                this.invalidate();
                return;
            }
            this._center.lat = center.lat;
            this._center.lon = center.lon;
            this.invalidate();
        }
    }

    public get zoom(): number {
        return this._lodf;
    }

    public set zoom(lodf: number) {
        if (this._lodf != lodf) {
            const old = this._lodf;
            this._lodf = lodf;
            if (this._zoomObservable && this._zoomObservable.hasObservers()) {
                const e = new PropertyChangedEventArgs(this, old, this._lodf);
                this._zoomObservable.notifyObservers(e);
            }
            this.invalidate();
        }
    }

    public get azimuth(): Bearing {
        return this._azimuth;
    }

    public set azimuth(r: Bearing) {
        if (this._azimuth.value != r.value) {
            const old = this._azimuth;
            this._azimuth = r;
            if (this._azimuthObservable && this._azimuthObservable.hasObservers()) {
                const e = new PropertyChangedEventArgs(this, old, this._azimuth);
                this._azimuthObservable.notifyObservers(e);
            }
            this.invalidate();
        }
    }

    public get centerObservable(): Observable<PropertyChangedEventArgs<ITileNavigationState, IGeo2>> {
        this._centerObservable = this._centerObservable || new Observable<PropertyChangedEventArgs<ITileNavigationState, IGeo2>>();
        return this._centerObservable;
    }

    public get zoomObservable(): Observable<PropertyChangedEventArgs<ITileNavigationState, number>> {
        this._zoomObservable = this._zoomObservable || new Observable<PropertyChangedEventArgs<ITileNavigationState, number>>();
        return this._zoomObservable;
    }

    public get azimuthObservable(): Observable<PropertyChangedEventArgs<ITileNavigationState, Bearing>> {
        this._azimuthObservable = this._azimuthObservable || new Observable<PropertyChangedEventArgs<ITileNavigationState, Bearing>>();
        return this._azimuthObservable;
    }

    public get stateChangedObservable(): Observable<ITileNavigationState> {
        this._stateChangedObservable = this._stateChangedObservable || new Observable<ITileNavigationState>();
        return this._stateChangedObservable;
    }

    public setView(center: IGeo2 | Array<number>, zoom?: number, rotation?: number): TileNavigationState {
        if (center) {
            if (Array.isArray(center)) {
                const lat = center.length > 0 ? center[0] : 0;
                const lon = center.length > 1 ? center[1] : 0;
                center = new Geo2(lat, lon);
            }
            this.center = center;
        }
        if (zoom) {
            this.zoom = zoom;
        }
        if (rotation) {
            this.azimuth = new Bearing(rotation);
        }
        return this;
    }

    public zoomIn(delta: number): TileNavigationState {
        this.zoom += delta;
        return this;
    }

    public zoomOut(delta: number): TileNavigationState {
        this.zoom -= delta;
        return this;
    }

    public translatePixel(tx: number, ty: number, metrics?: ITileMetrics): TileNavigationState {
        const m = metrics ?? EPSG3857.Shared;
        if (this._azimuth) {
            const p = this.rotatePointInv(tx, ty, this._cartesianCache);
            tx = p.x;
            ty = p.y;
        }
        const lod = Math.round(this._lodf);
        const pixelCenterXY = m.getLatLonToPixelXY(this._center.lat, this._center.lon, lod);
        pixelCenterXY.x += tx;
        pixelCenterXY.y += ty;
        this.center = m.getPixelXYToLatLon(pixelCenterXY.x, pixelCenterXY.y, lod);
        return this;
    }

    public translate(lat: IGeo2 | Array<number> | number, lon?: number): TileNavigationState {
        if (lat) {
            let dlat;
            let dlon;
            if (Array.isArray(lat)) {
                dlat = lat.length > 0 ? lat[0] : 0;
                dlon = lat.length > 1 ? lat[1] : 0;
            } else if (IsLocation(lat)) {
                dlat = lat.lat;
                dlon = lat.lon;
            } else {
                dlat = lat;
                dlon = lon ?? 0;
            }
            this.center = new Geo2(this._center.lat + dlat, this._center.lon + dlon);
        }
        return this;
    }

    public rotate(r: number): TileNavigationState {
        this.azimuth = new Bearing(this._azimuth.value + r);
        return this;
    }

    protected _doValidate() {
        // dispatch event
        if (this._stateChangedObservable && this._stateChangedObservable.hasObservers()) {
            this._stateChangedObservable.notifyObservers(this);
        }
    }

    private rotatePointInv<R extends ICartesian2>(x: number, y: number, target?: R): R {
        const r = target || Cartesian2.Zero();
        r.x = x * this._azimuth.cos + y * this._azimuth.sin;
        r.y = -x * this._azimuth.sin + y * this._azimuth.cos;
        return <R>r;
    }
}
