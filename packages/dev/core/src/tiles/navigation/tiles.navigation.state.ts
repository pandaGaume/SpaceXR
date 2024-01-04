import { PropertyChangedEventArgs, Observable } from "../../events";
import { ITileNavigationState } from "./tiles.navigation.interfaces";
import { ValidableBase } from "../../types";
import { ITileMetrics } from "../tiles.interfaces";
import { ICartesian2, Cartesian2 } from "../../geometry";
import { IGeo2, IsLocation, Bearing, Geo2 } from "../../geography";
import { EPSG3857 } from "../geography";

export class TileNavigationState extends ValidableBase implements ITileNavigationState {
    public static GetLodScale(lod: number): number {
        let lodOffset = (lod * 1000 - Math.round(lod) * 1000) / 1000; // Trick to avoid floating point error.
        // scale corresponding to the decimal part
        let scale = lodOffset < 0 ? 1 + lodOffset / 2 : 1 + lodOffset;
        return scale;
    }

    _propertyChangedObservable?: Observable<PropertyChangedEventArgs<ITileNavigationState, unknown>>;
    _stateChangedObservable?: Observable<ITileNavigationState>;

    _lodf: number;
    _center: IGeo2;
    _azimuth: Bearing;

    // internal
    _cartesianCache: ICartesian2 = Cartesian2.Zero();
    _lod: number;
    _scale: number;

    public constructor(metrics: ITileMetrics, center?: IGeo2, lod?: number, azimuth?: number) {
        super();
        this._lodf = 0;
        this._center = Geo2.Zero();
        this._azimuth = new Bearing(azimuth ?? 0);
        this._lod = Math.round(this._lodf);
        this._scale = TileNavigationState.GetLodScale(this._lodf);
    }

    public get lod(): number {
        return this._lod;
    }

    public get scale(): number {
        return this._scale;
    }

    public get center(): IGeo2 {
        return this._center;
    }

    public set center(center: IGeo2) {
        if (center && !this._center.equals(center)) {
            if (this._propertyChangedObservable?.hasObservers()) {
                const old = this._center.clone();
                this._center.lat = center.lat;
                this._center.lon = center.lon;
                const e = new PropertyChangedEventArgs(this, old, center, "center");
                this._propertyChangedObservable.notifyObservers(e, -1, this, this);
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
            this._lod = Math.round(this._lodf);
            this._scale = TileNavigationState.GetLodScale(this._lodf);
            this.invalidate();
            if (this._propertyChangedObservable?.hasObservers()) {
                const e = new PropertyChangedEventArgs(this, old, this._lodf, "zoom");
                this._propertyChangedObservable.notifyObservers(e, -1, this, this);
            }
        }
    }

    public get azimuth(): Bearing {
        return this._azimuth;
    }

    public set azimuth(r: Bearing) {
        if (this._azimuth.value != r.value) {
            const old = this._azimuth;
            this._azimuth = r;
            this.invalidate();
            if (this._propertyChangedObservable?.hasObservers()) {
                const e = new PropertyChangedEventArgs(this, old, this._azimuth, "azimuth");
                this._propertyChangedObservable.notifyObservers(e, -1, this, this);
            }
        }
    }

    public get propertyChangedObservable(): Observable<PropertyChangedEventArgs<ITileNavigationState, unknown>> {
        if (!this._propertyChangedObservable) this._propertyChangedObservable = new Observable<PropertyChangedEventArgs<ITileNavigationState, unknown>>();
        return this._propertyChangedObservable;
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
        if (zoom !== undefined) {
            this.zoom = zoom;
        }
        if (rotation !== undefined) {
            this.azimuth = new Bearing(rotation);
        }
        return this;
    }

    public zoomIn(delta: number): TileNavigationState {
        this.zoom = this._lodf + Math.abs(delta);
        return this;
    }

    public zoomOut(delta: number): TileNavigationState {
        this.zoom = this._lodf - Math.abs(delta);
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
