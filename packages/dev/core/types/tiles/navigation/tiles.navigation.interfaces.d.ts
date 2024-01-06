import { IGeo2, Bearing } from "../../geography";
import { PropertyChangedEventArgs, Observable } from "../../events";
import { ITileMetrics, ITileSystemBounds } from "../tiles.interfaces";
import { IValidable } from "../../types";
export interface ITileNavigationState extends ITileNavigationApi<ITileNavigationState> {
    propertyChangedObservable: Observable<PropertyChangedEventArgs<ITileNavigationState, unknown>>;
    stateChangedObservable: Observable<ITileNavigationState>;
    center: IGeo2;
    zoom: number;
    azimuth: Bearing;
    bounds: ITileSystemBounds;
    lod: number;
    scale: number;
}
export declare function IsTileNavigationState(b: unknown): b is ITileNavigationState;
export interface ITileNavigationApi<T> extends IValidable<unknown> {
    setView(center: IGeo2 | Array<number>, zoom?: number, rotation?: number): T;
    zoomIn(delta: number): T;
    zoomOut(delta: number): T;
    translatePixel(tx: number, ty: number, metrics?: ITileMetrics): T;
    translate(lat: IGeo2 | Array<number> | number, lon?: number): T;
    rotate(r: number): T;
}
export declare function IsTileNavigationApi<T>(b: unknown): b is ITileNavigationApi<T>;
