import { IGeo2, IsLocation, Bearing } from "../../geography";
import { PropertyChangedEventArgs, Observable } from "../../events";
import { ITileMetrics, ITileSystemBounds, IsTileSystemBounds } from "../tiles.interfaces";
import { ICloneable, IValidable, Nullable } from "../../types";

export interface IHasNavigationState {
    navigation: ITileNavigationState;
}

export function hasNavigationState(obj: unknown): obj is IHasNavigationState {
    if (typeof obj !== "object" || obj === null) return false;
    return (<IHasNavigationState>obj).navigation !== undefined;
}

export interface ITileNavigationState extends ITileNavigationApi<ITileNavigationState>, IValidable, ICloneable<ITileNavigationState> {
    propertyChangedObservable: Observable<PropertyChangedEventArgs<ITileNavigationState, unknown>>;

    center: IGeo2;
    zoom: number;
    azimuth: Bearing;
    bounds: ITileSystemBounds;

    lod: number; // Math.round(zoom)
    scale: number; // scale corresponding to the decimal part of zoom
    minZoom?: number;
    maxZoom?: number;

    syncWith(state: Nullable<ITileNavigationState>): void;
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
    setViewMap(center: IGeo2 | Array<number>, zoom?: number, rotation?: number, validate?: boolean): T;
    zoomMap(delta: number, validate?: boolean): T;
    zoomInMap(delta: number, validate?: boolean): T;
    zoomOutMap(delta: number, validate?: boolean): T;
    translateUnitsMap(tx: number, ty: number, metrics?: ITileMetrics, validate?: boolean): T;
    translateMap(dlat: IGeo2 | Array<number> | number, dlon?: number, validate?: boolean): T;
    rotateMap(r: number, validate?: boolean): T;
}

export function IsTileNavigationApi<T>(b: unknown): b is ITileNavigationApi<T> {
    if (b === null || typeof b !== "object") return false;
    return (
        (<ITileNavigationApi<T>>b).setViewMap !== undefined &&
        (<ITileNavigationApi<T>>b).zoomInMap !== undefined &&
        (<ITileNavigationApi<T>>b).zoomOutMap !== undefined &&
        (<ITileNavigationApi<T>>b).translateUnitsMap !== undefined &&
        (<ITileNavigationApi<T>>b).translateMap !== undefined &&
        (<ITileNavigationApi<T>>b).rotateMap !== undefined
    );
}

export interface IHasNavigationApi<T> {
    navigationApi: ITileNavigationApi<T>;
}

export function hasNavigationApi<T>(obj: unknown): obj is IHasNavigationApi<T> {
    if (typeof obj !== "object" || obj === null) return false;
    return (<IHasNavigationApi<T>>obj).navigationApi !== undefined;
}
