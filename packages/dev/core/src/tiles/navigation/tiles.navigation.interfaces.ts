import { IGeo2, IsLocation, Bearing } from "../../geography";
import { PropertyChangedEventArgs, Observable } from "../../events";
import { ITileMetrics, ITileSystemBounds, IsTileSystemBounds } from "../tiles.interfaces";
import { IValidable } from "../../types";

export interface ITileNavigationState extends ITileNavigationApi<ITileNavigationState>, IValidable<unknown> {
    propertyChangedObservable: Observable<PropertyChangedEventArgs<ITileNavigationState, unknown>>;
    stateChangedObservable: Observable<ITileNavigationState>;

    center: IGeo2;
    zoom: number;
    azimuth: Bearing;
    bounds: ITileSystemBounds;

    lod: number; // Math.round(zoom)
    scale: number; // scale corresponding to the decimal part of zoom
}

export function IsTileNavigationState(b: unknown): b is ITileNavigationState {
    if (b === null || typeof b !== "object") return false;
    return (
        IsTileNavigationApi<ITileNavigationState>(b) &&
        (<ITileNavigationState>b).center !== undefined &&
        IsLocation((<ITileNavigationState>b).center) &&
        (<ITileNavigationState>b).zoom !== undefined &&
        (<ITileNavigationState>b).azimuth !== undefined &&
        (<ITileNavigationState>b).azimuth instanceof Bearing &&
        (<ITileNavigationState>b).bounds !== undefined &&
        IsTileSystemBounds((<ITileNavigationState>b).bounds)
    );
}

export interface ITileNavigationApi<T> {
    setView(center?: IGeo2 | Array<number>, zoom?: number, rotation?: number): T;
    zooming(delta: number): T;
    zoomIn(delta: number): T;
    zoomOut(delta: number): T;
    translatePixel(tx: number, ty: number, metrics?: ITileMetrics): T;
    translate(lat: IGeo2 | Array<number> | number, lon?: number): T;
    rotate(r: number): T;
}

export function IsTileNavigationApi<T>(b: unknown): b is ITileNavigationApi<T> {
    if (b === null || typeof b !== "object") return false;
    return (
        (<ITileNavigationApi<T>>b).setView !== undefined &&
        (<ITileNavigationApi<T>>b).zoomIn !== undefined &&
        (<ITileNavigationApi<T>>b).zoomOut !== undefined &&
        (<ITileNavigationApi<T>>b).translatePixel !== undefined &&
        (<ITileNavigationApi<T>>b).translate !== undefined &&
        (<ITileNavigationApi<T>>b).rotate !== undefined
    );
}
