import { ISize2 } from "../geometry/geometry.interfaces";
import { PropertyChangedEventArgs } from "../events/events.args";
import { Observable } from "../events/events.observable";
import { IGeo2 } from "../geography/geography.interfaces";
import { ITileClient, ITileMetricsProvider } from "./tiles.interfaces";
export interface ITileMapApi extends ITileMetricsProvider, ISize2 {
    resizeObservable: Observable<PropertyChangedEventArgs<ITileMapApi, ISize2>>;
    centerObservable: Observable<PropertyChangedEventArgs<ITileMapApi, IGeo2>>;
    zoomObservable: Observable<PropertyChangedEventArgs<ITileMapApi, number>>;
    azimuthObservable: Observable<PropertyChangedEventArgs<ITileMapApi, number>>;
    invalidateSize(w: number, h: number): ITileMapApi;
    setView(center: IGeo2, zoom?: number, rotation?: number): ITileMapApi;
    setZoom(zoom: number): ITileMapApi;
    setAzimuth(r: number): ITileMapApi;
    zoomIn(delta: number): ITileMapApi;
    zoomOut(delta: number): ITileMapApi;
    translate(tx: number, ty: number): ITileMapApi;
    rotate(r: number): ITileMapApi;
}
export interface ITileMapLayerApi<T> {
    addLayer(key: string, source: ITileClient<T>): ITileMapLayerApi<T>;
    removeLayer(key: string): ITileMapLayerApi<T>;
    setMainLayer(key: string): ITileMapLayerApi<T>;
}
