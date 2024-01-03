import { IGeo2, IsLocation } from "../../geography/geography.interfaces";
import { PropertyChangedEventArgs } from "../../events/events.args";
import { Observable } from "../../events/events.observable";
import { Bearing } from "../../geography/geography.bearing";
import { ITileMetrics } from "../tiles.interfaces";
import { IValidable } from "../../types";

export interface ITileNavigationState extends ITileNavigationApi<ITileNavigationState> {
    propertyChangedObservable: Observable<PropertyChangedEventArgs<ITileNavigationState, unknown>>;
    stateChangedObservable: Observable<ITileNavigationState>;

    center: IGeo2;
    zoom: number;
    azimuth: Bearing;

    lod: number; // Math.round(zoom)
    scale: number; // scale corresponding to the decimal part of zoom
}

export function IsTileNavigationState(b: unknown): b is ITileNavigationState {
    if (b === null || typeof b !== "object") return false;
    return (
        (<ITileNavigationState>b).center !== undefined &&
        IsLocation((<ITileNavigationState>b).center) &&
        (<ITileNavigationState>b).zoom !== undefined &&
        (<ITileNavigationState>b).azimuth !== undefined &&
        (<ITileNavigationState>b).azimuth instanceof Bearing
    );
}

export interface ITileNavigationApi<T> extends IValidable<unknown> {
    setView(center: IGeo2 | Array<number>, zoom?: number, rotation?: number): T;
    zoomIn(delta: number): T;
    zoomOut(delta: number): T;
    translatePixel(tx: number, ty: number, metrics?: ITileMetrics): T;
    translate(lat: IGeo2 | Array<number> | number, lon?: number): T;
    rotate(r: number): T;
}
