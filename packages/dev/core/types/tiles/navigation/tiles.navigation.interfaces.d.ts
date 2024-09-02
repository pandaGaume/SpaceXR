import { IGeo2, Bearing } from "../../geography";
import { PropertyChangedEventArgs, Observable } from "../../events";
import { ITileMetrics, ITileSystemBounds } from "../tiles.interfaces";
import { ICloneable, IValidable, Nullable } from "../../types";
export interface IHasNavigationState {
    navigation: Nullable<ITileNavigationState>;
}
export declare function hasNavigationState(obj: unknown): obj is IHasNavigationState;
export interface ITileNavigationState extends ITileNavigationApi<ITileNavigationState>, IValidable, ICloneable<ITileNavigationState> {
    propertyChangedObservable: Observable<PropertyChangedEventArgs<ITileNavigationState, unknown>>;
    center: IGeo2;
    zoom: number;
    azimuth: Bearing;
    bounds: ITileSystemBounds;
    lod: number;
    scale: number;
    minZoom?: number;
    maxZoom?: number;
    syncWith(state: Nullable<ITileNavigationState>): void;
}
export declare function IsTileNavigationState(b: unknown): b is ITileNavigationState;
export interface ITileNavigationApi<T> {
    setViewMap(center: IGeo2 | Array<number>, zoom?: number, rotation?: number, validate?: boolean): T;
    zoomMap(delta: number, validate?: boolean): T;
    zoomInMap(delta: number, validate?: boolean): T;
    zoomOutMap(delta: number, validate?: boolean): T;
    translateUnitsMap(tx: number, ty: number, metrics?: ITileMetrics, validate?: boolean): T;
    translateMap(dlat: IGeo2 | Array<number> | number, dlon?: number, validate?: boolean): T;
    rotateMap(r: number, validate?: boolean): T;
}
export declare function IsTileNavigationApi<T>(b: unknown): b is ITileNavigationApi<T>;
export interface IHasNavigationApi<T> {
    navigationApi: ITileNavigationApi<T>;
}
export declare function hasNavigationApi<T>(obj: unknown): obj is IHasNavigationApi<T>;
