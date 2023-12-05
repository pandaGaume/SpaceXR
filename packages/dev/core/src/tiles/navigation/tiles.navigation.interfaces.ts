import { IGeo2 } from "../../geography/geography.interfaces";
import { PropertyChangedEventArgs } from "../../events/events.args";
import { Observable } from "../../events/events.observable";
import { IValidable } from "../../types";

export interface ITileNavigationState extends IValidable<ITileNavigationState> {
    centerObservable: Observable<PropertyChangedEventArgs<ITileNavigationState, IGeo2>>;
    zoomObservable: Observable<PropertyChangedEventArgs<ITileNavigationState, number>>;
    azimuthObservable: Observable<PropertyChangedEventArgs<ITileNavigationState, number>>;
    stateChangedObservable: Observable<ITileNavigationState>;

    center: IGeo2;
    zoom: number;
    azimuth: number;
}

export interface ITileNavigationApi extends ITileNavigationState {
    setView(center: IGeo2, zoom?: number, rotation?: number): ITileNavigationApi;
    zoomIn(delta: number): ITileNavigationApi;
    zoomOut(delta: number): ITileNavigationApi;
    translate(tx: number, ty: number): ITileNavigationApi;
    rotate(r: number): ITileNavigationApi;
}
