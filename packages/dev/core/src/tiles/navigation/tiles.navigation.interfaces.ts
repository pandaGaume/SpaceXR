import { IGeo2, IsLocation, Bearing } from "../../geography";
import { PropertyChangedEventArgs, Observable } from "../../events";
import { ITileSystemBounds, IsTileSystemBounds } from "../tiles.interfaces";
import { ICloneable, IDisposable, IValidable, Nullable } from "../../types";

export interface IHasNavigationState {
    navigationState: Nullable<ITileNavigationState>;
}

export function HasNavigationState(obj: unknown): obj is IHasNavigationState {
    if (typeof obj !== "object" || obj === null) return false;
    return (<IHasNavigationState>obj).navigationState !== undefined;
}

export interface ITileNavigationState extends IValidable, ICloneable<ITileNavigationState>, IDisposable {
    propertyChangedObservable: Observable<PropertyChangedEventArgs<ITileNavigationState, unknown>>;

    center: IGeo2;
    zoom: number;
    azimuth: Bearing;
    bounds: ITileSystemBounds;

    lod: number; // Math.round(zoom)
    scale: number; // scale corresponding to the decimal part of zoom

    copy(state: ITileNavigationState): ITileNavigationState;
    syncWith(state: Nullable<ITileNavigationState>): ITileNavigationState;
}

export function IsTileNavigationState(b: unknown): b is ITileNavigationState {
    if (b === null || typeof b !== "object") return false;
    return (
        (<ITileNavigationState>b).center !== undefined &&
        IsLocation((<ITileNavigationState>b).center) &&
        (<ITileNavigationState>b).zoom !== undefined &&
        (<ITileNavigationState>b).azimuth !== undefined &&
        (<ITileNavigationState>b).azimuth instanceof Bearing &&
        (<ITileNavigationState>b).bounds !== undefined &&
        IsTileSystemBounds((<ITileNavigationState>b).bounds)
    );
}

export interface ITileNavigationApi extends IHasNavigationState, IDisposable {
    setViewMap(center: IGeo2 | Array<number>, zoom?: number, rotation?: number, validate?: boolean): ITileNavigationApi;
    zoomMap(delta: number, validate?: boolean): ITileNavigationApi;
    zoomInMap(delta: number, validate?: boolean): ITileNavigationApi;
    zoomOutMap(delta: number, validate?: boolean): ITileNavigationApi;
    translateUnitsMap(tx: number, ty: number, validate?: boolean): ITileNavigationApi;
    translateMap(dlat: IGeo2 | Array<number> | number, dlon?: number, validate?: boolean): ITileNavigationApi;
    rotateMap(r: number, validate?: boolean): ITileNavigationApi;
}

export function IsTileNavigationApi(b: unknown): b is ITileNavigationApi {
    if (b === null || typeof b !== "object") return false;
    return (
        (<ITileNavigationApi>b).setViewMap !== undefined &&
        (<ITileNavigationApi>b).zoomInMap !== undefined &&
        (<ITileNavigationApi>b).zoomOutMap !== undefined &&
        (<ITileNavigationApi>b).translateUnitsMap !== undefined &&
        (<ITileNavigationApi>b).translateMap !== undefined &&
        (<ITileNavigationApi>b).rotateMap !== undefined
    );
}

export interface IHasNavigationApi {
    navigationApi: Nullable<ITileNavigationApi>;
}

export function HasNavigationApi<T>(obj: unknown): obj is IHasNavigationApi {
    if (typeof obj !== "object" || obj === null) return false;
    return (<IHasNavigationApi>obj).navigationApi !== undefined;
}
