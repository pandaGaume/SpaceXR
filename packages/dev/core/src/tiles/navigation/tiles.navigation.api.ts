import { ICameraViewState, ITileNavigationApi, ITileNavigationState } from "./tiles.navigation.interfaces";
import { IDisposable } from "../../types";
import { ITileMetrics } from "../tiles.interfaces";
import { ICartesian2, Cartesian2 } from "../../geometry";
import { IGeo2, IsLocation, Bearing, Geo2 } from "../../geography";
import { TileMetrics } from "../tiles.metrics";

export class TileNavigationApi implements ITileNavigationApi, IDisposable {
    private _navigation: ITileNavigationState;
    private _cartesianCache: ICartesian2 = Cartesian2.Zero();
    private _metrics: ITileMetrics;

    public constructor(navigation: ITileNavigationState, metrics?: ITileMetrics) {
        this._navigation = navigation;
        this._metrics = metrics ?? TileMetrics.Shared;
    }

    public get navigationState(): ITileNavigationState {
        return this._navigation;
    }

    public get metrics(): ITileMetrics {
        return this._metrics;
    }

    public dispose() {}

    public setViewMap(center?: IGeo2 | Array<number>, zoom?: number, rotation?: number, validate?: boolean): ITileNavigationApi {
        if (center) {
            let lat = 0;
            let lon = 0;

            if (Array.isArray(center)) {
                lat = center.length > 0 ? center[0] : 0;
                lon = center.length > 1 ? center[1] : 0;
            } else {
                lat = center.lat;
                lon = center.lon;
            }
            this._navigation.center = new Geo2(lat, lon);
        }
        if (zoom !== undefined) {
            this._navigation.zoom = zoom;
        }
        if (rotation !== undefined && rotation !== this._navigation.azimuth?.value) {
            this._navigation.azimuth = new Bearing(rotation);
        }
        if (validate === undefined || validate === true) {
            this._navigation.validate();
        }
        return this;
    }

    public zoomInMap(delta: number, validate?: boolean): ITileNavigationApi {
        this._navigation.zoom = this._navigation.zoom + Math.abs(delta);
        if (validate === undefined || validate === true) {
            this._navigation.validate();
        }
        return this;
    }

    public zoomMap(delta: number, validate?: boolean): ITileNavigationApi {
        this._navigation.zoom = this._navigation.zoom + delta;
        if (validate === undefined || validate === true) {
            this._navigation.validate();
        }
        return this;
    }

    public zoomOutMap(delta: number, validate?: boolean): ITileNavigationApi {
        this._navigation.zoom = this._navigation.zoom - Math.abs(delta);
        if (validate === undefined || validate === true) {
            this._navigation.validate();
        }
        return this;
    }

    public translateUnitsMap(tx: number, ty: number, validate?: boolean): ITileNavigationApi {
        const m = this._metrics;
        if (this._navigation.azimuth?.value) {
            const p = this.rotatePointInv(tx, ty, this._cartesianCache);
            tx = p.x;
            ty = p.y;
        }
        const lod = Math.round(this._navigation.zoom);
        const center = this._navigation.center;
        const pixelCenterXY = m.getLatLonToPointXY(center.lat, center.lon, lod);
        pixelCenterXY.x += tx;
        pixelCenterXY.y += ty;
        this._navigation.center = m.getPointXYToLatLon(pixelCenterXY.x, pixelCenterXY.y, lod);
        if (validate === undefined || validate === true) {
            this._navigation.validate();
        }
        return this;
    }

    public translateMap(lat: IGeo2 | Array<number> | number, lon?: number, validate?: boolean): ITileNavigationApi {
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
            const center = this._navigation.center;
            this._navigation.center = new Geo2(center.lat + dlat, center.lon + dlon);
            if (validate === undefined || validate === true) {
                this._navigation.validate();
            }
        }
        return this;
    }

    public rotateMap(r: number, validate?: boolean): ITileNavigationApi {
        this._navigation.azimuth = new Bearing(this._navigation.azimuth.value + r);
        if (validate === undefined || validate === true) {
            this._navigation.validate();
        }
        return this;
    }

    public setCameraState(state: ICameraViewState, validate?: boolean): ITileNavigationApi {
        this._navigation.camera = state;
        if (validate === undefined || validate === true) {
            this._navigation.validate();
        }
        return this;
    }

    private rotatePointInv<R extends ICartesian2>(x: number, y: number, target?: R): R {
        const r = target || Cartesian2.Zero();
        const azimuth = this._navigation.azimuth;
        r.x = x * azimuth.cos + y * azimuth.sin;
        r.y = -x * azimuth.sin + y * azimuth.cos;
        return <R>r;
    }
}
