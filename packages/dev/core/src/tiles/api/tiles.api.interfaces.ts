import { ICartesian2, IRectangle, ISize2 } from "../../geometry/geometry.interfaces";
import { PropertyChangedEventArgs } from "../../events/events.args";
import { Observable } from "../../events/events.observable";
import { IGeo2, IGeoBounded } from "../../geography/geography.interfaces";
import { ITileAddress, ITileClient, ITileMetricsProvider } from "../tiles.interfaces";

// @deprecated
export interface ITileMapApi extends ITileMetricsProvider, ISize2, IGeoBounded {
    centerObservable: Observable<PropertyChangedEventArgs<ITileMapApi, IGeo2>>;
    zoomObservable: Observable<PropertyChangedEventArgs<ITileMapApi, number>>;
    azimuthObservable: Observable<PropertyChangedEventArgs<ITileMapApi, number>>;
    viewChangedObservable: Observable<ITileMapApi>;

    center: IGeo2;
    zoom: number;
    levelOfDetail: number;
    azimuth: number;
    scale: number;
    centerXY: ICartesian2;
    boundsXY: IRectangle;

    setView(center: IGeo2, zoom?: number, rotation?: number): ITileMapApi;
    setZoom(zoom: number): ITileMapApi;
    setAzimuth(r: number): ITileMapApi;
    zoomIn(delta: number): ITileMapApi;
    zoomOut(delta: number): ITileMapApi;
    translate(tx: number, ty: number): ITileMapApi;
    rotate(r: number): ITileMapApi;
}

export interface ITileMapLayerApi<T> {
    addLayer(key: string, source: ITileClient<T,ITileAddress>): ITileMapLayerApi<T>;
    removeLayer(key: string): ITileMapLayerApi<T>;
    setMainLayer(key: string): ITileMapLayerApi<T>;
}
