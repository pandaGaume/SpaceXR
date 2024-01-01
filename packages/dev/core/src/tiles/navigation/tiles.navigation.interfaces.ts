import { IGeo2, isLocation } from "../../geography/geography.interfaces";
import { PropertyChangedEventArgs } from "../../events/events.args";
import { Observable } from "../../events/events.observable";
import { ITileMetricsProvider } from "../tiles.interfaces";
import { Bearing } from "../../geography/geography.bearing";
import { ICartesian2 } from "../../geometry/geometry.interfaces";

export interface ITileNavigationState extends ITileMetricsProvider {
    centerObservable: Observable<PropertyChangedEventArgs<ITileNavigationState, IGeo2>>;
    zoomObservable: Observable<PropertyChangedEventArgs<ITileNavigationState, number>>;
    azimuthObservable: Observable<PropertyChangedEventArgs<ITileNavigationState, Bearing>>;
    stateChangedObservable: Observable<ITileNavigationState>;

    center: IGeo2;
    zoom: number;
    azimuth: Bearing;

    lod: number; // Math.round(zoom)
    scale: number; // scale corresponding to the decimal part of zoom
    pixelXY: ICartesian2; // metrics.getLatLonToPixelXY(center.lat, center.lon, lod)
}

export function IsTileNavigationState(b: unknown): b is ITileNavigationState {
    if (b === null || typeof b !== "object") return false;
    return (
        (<ITileNavigationState>b).center !== undefined &&
        isLocation((<ITileNavigationState>b).center) &&
        (<ITileNavigationState>b).zoom !== undefined &&
        (<ITileNavigationState>b).azimuth !== undefined &&
        (<ITileNavigationState>b).azimuth instanceof Bearing
    );
}

export interface ITileNavigationApi extends ITileNavigationState {
    setView(center: IGeo2, zoom?: number, rotation?: number): void;
    zoomIn(delta: number): void;
    zoomOut(delta: number): void;
    translate(tx: number, ty: number): void;
    rotate(r: number): void;
}
