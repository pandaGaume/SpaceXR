import { IGeo2, IsLocation, Bearing } from "../../geography";
import { PropertyChangedEventArgs, Observable } from "../../events";
import { ITileMetrics, ITileSystemBounds, IsTileSystemBounds } from "../tiles.interfaces";
import { ICloneable, IValidable } from "../../types";

export interface ITileNavigationState extends ITileNavigationApi<ITileNavigationState>, IValidable, ICloneable<ITileNavigationState> {
    propertyChangedObservable: Observable<PropertyChangedEventArgs<ITileNavigationState, unknown>>;
    stateChangedObservable: Observable<ITileNavigationState>;

    center: IGeo2;
    zoom: number;
    azimuth: Bearing;
    bounds: ITileSystemBounds;

    lod: number; // Math.round(zoom)
    scale: number; // scale corresponding to the decimal part of zoom

    syncWith(state: ITileNavigationState): void;
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
    setViewMap(center: IGeo2 | Array<number>, zoom?: number, rotation?: number): T;
    zoomMap(delta: number): T;
    zoomInMap(delta: number): T;
    zoomOutMap(delta: number): T;
    translatePixelMap(tx: number, ty: number, metrics?: ITileMetrics): T;
    translateMap(lat: IGeo2 | Array<number> | number, lon?: number): T;
    rotateMap(r: number): T;
}

export function IsTileNavigationApi<T>(b: unknown): b is ITileNavigationApi<T> {
    if (b === null || typeof b !== "object") return false;
    return (
        (<ITileNavigationApi<T>>b).setViewMap !== undefined &&
        (<ITileNavigationApi<T>>b).zoomInMap !== undefined &&
        (<ITileNavigationApi<T>>b).zoomOutMap !== undefined &&
        (<ITileNavigationApi<T>>b).translatePixelMap !== undefined &&
        (<ITileNavigationApi<T>>b).translateMap !== undefined &&
        (<ITileNavigationApi<T>>b).rotateMap !== undefined
    );
}
