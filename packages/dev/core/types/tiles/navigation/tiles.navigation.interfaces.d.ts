import { IGeo2 } from "../../geography/geography.interfaces";
import { PropertyChangedEventArgs } from "../../events/events.args";
import { Observable } from "../../events/events.observable";
import { ITileMetricsProvider } from "../tiles.interfaces";
import { Bearing } from "../../geography/geography.bearing";
import { ICartesian2 } from "../../geometry/geometry.interfaces";
export interface ITileNavigationState extends ITileMetricsProvider {
    centerObservable: Observable<PropertyChangedEventArgs<ITileNavigationState, IGeo2>>;
    zoomObservable: Observable<PropertyChangedEventArgs<ITileNavigationState, number>>;
    azimuthObservable: Observable<PropertyChangedEventArgs<ITileNavigationState, Bearing>>;
    stateChangedObservable: Observable<ITileNavigationState>;
    center: IGeo2;
    zoom: number;
    azimuth: Bearing;
    lod: number;
    scale: number;
    pixelXY: ICartesian2;
}
export declare function IsTileNavigationState(b: unknown): b is ITileNavigationState;
export interface ITileNavigationApi extends ITileNavigationState {
    setView(center: IGeo2, zoom?: number, rotation?: number): void;
    zoomIn(delta: number): void;
    zoomOut(delta: number): void;
    translate(tx: number, ty: number): void;
    rotate(r: number): void;
}
