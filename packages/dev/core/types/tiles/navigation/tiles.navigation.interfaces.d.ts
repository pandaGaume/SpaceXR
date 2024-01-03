import { IGeo2 } from "../../geography/geography.interfaces";
import { PropertyChangedEventArgs } from "../../events/events.args";
import { Observable } from "../../events/events.observable";
import { Bearing } from "../../geography/geography.bearing";
import { ITileMetrics } from "../tiles.interfaces";
export interface ITileNavigationState extends ITileNavigationApi<unknown> {
    centerObservable: Observable<PropertyChangedEventArgs<ITileNavigationState, IGeo2>>;
    zoomObservable: Observable<PropertyChangedEventArgs<ITileNavigationState, number>>;
    azimuthObservable: Observable<PropertyChangedEventArgs<ITileNavigationState, Bearing>>;
    stateChangedObservable: Observable<ITileNavigationState>;
    center: IGeo2;
    zoom: number;
    azimuth: Bearing;
    lod: number;
    scale: number;
}
export declare function IsTileNavigationState(b: unknown): b is ITileNavigationState;
export interface ITileNavigationApi<T> {
    setView(center: IGeo2 | Array<number>, zoom?: number, rotation?: number): T;
    zoomIn(delta: number): T;
    zoomOut(delta: number): T;
    translatePixel(tx: number, ty: number, metrics?: ITileMetrics): T;
    translate(lat: IGeo2 | Array<number> | number, lon?: number): T;
    rotate(r: number): T;
}
