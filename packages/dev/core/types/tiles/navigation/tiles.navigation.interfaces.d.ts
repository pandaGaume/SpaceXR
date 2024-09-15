import { IGeo2, Bearing } from "../../geography";
import { PropertyChangedEventArgs, Observable } from "../../events";
import { ITileSystemBounds } from "../tiles.interfaces";
import { ICloneable, IDisposable, IValidable, Nullable } from "../../types";
export interface IHasNavigationState {
    navigationState: Nullable<ITileNavigationState>;
}
export declare function HasNavigationState(obj: unknown): obj is IHasNavigationState;
export interface ITileNavigationState extends IValidable, ICloneable<ITileNavigationState>, IDisposable {
    propertyChangedObservable: Observable<PropertyChangedEventArgs<ITileNavigationState, unknown>>;
    center: IGeo2;
    zoom: number;
    azimuth: Bearing;
    bounds: ITileSystemBounds;
    lod: number;
    scale: number;
    copy(state: ITileNavigationState): ITileNavigationState;
    syncWith(state: Nullable<ITileNavigationState>): ITileNavigationState;
}
export declare function IsTileNavigationState(b: unknown): b is ITileNavigationState;
export interface ITileNavigationApi extends IHasNavigationState, IDisposable {
    setViewMap(center: IGeo2 | Array<number>, zoom?: number, rotation?: number, validate?: boolean): ITileNavigationApi;
    zoomMap(delta: number, validate?: boolean): ITileNavigationApi;
    zoomInMap(delta: number, validate?: boolean): ITileNavigationApi;
    zoomOutMap(delta: number, validate?: boolean): ITileNavigationApi;
    translateUnitsMap(tx: number, ty: number, validate?: boolean): ITileNavigationApi;
    translateMap(dlat: IGeo2 | Array<number> | number, dlon?: number, validate?: boolean): ITileNavigationApi;
    rotateMap(r: number, validate?: boolean): ITileNavigationApi;
}
export declare function IsTileNavigationApi(b: unknown): b is ITileNavigationApi;
export interface IHasNavigationApi {
    navigationApi: Nullable<ITileNavigationApi>;
}
export declare function HasNavigationApi<T>(obj: unknown): obj is IHasNavigationApi;
