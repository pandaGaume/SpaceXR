import { IGeo2, Bearing } from "../../geography";
import { PropertyChangedEventArgs, Observable } from "../../events";
import { ITileMetrics, ITileSystemBounds } from "../tiles.interfaces";
import { ICloneable, IValidable, Nullable } from "../../types";
export interface IHasNavigationState {
    navigation: ITileNavigationState;
}
export declare function hasNavigationState(obj: unknown): obj is IHasNavigationState;
export interface ITileNavigationState extends ITileNavigationApi<ITileNavigationState>, IValidable, ICloneable<ITileNavigationState> {
    propertyChangedObservable: Observable<PropertyChangedEventArgs<ITileNavigationState, unknown>>;
    stateChangedObservable: Observable<ITileNavigationState>;
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
    setViewMap(center: IGeo2 | Array<number>, zoom?: number, rotation?: number): T;
    zoomMap(delta: number): T;
    zoomInMap(delta: number): T;
    zoomOutMap(delta: number): T;
    translateUnitsMap(tx: number, ty: number, metrics?: ITileMetrics): T;
    translateMap(dlat: IGeo2 | Array<number> | number, dlon?: number): T;
    rotateMap(r: number): T;
}
export declare function IsTileNavigationApi<T>(b: unknown): b is ITileNavigationApi<T>;
export interface IHasNavigationApi<T> {
    navigationApi: ITileNavigationApi<T>;
}
export declare function hasNavigationApi<T>(obj: unknown): obj is IHasNavigationApi<T>;
