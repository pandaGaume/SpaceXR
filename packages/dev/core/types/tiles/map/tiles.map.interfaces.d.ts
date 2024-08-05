import { Observable } from "../../events/events.observable";
import { IHasNavigationState, ITileNavigationApi } from "../navigation/tiles.navigation.interfaces";
import { ITargetBlock, ITileView } from "../pipeline/tiles.pipeline.interfaces";
import { IHasActivTiles, ITile, ITileAddress, ITileMetricsProvider, ITileProvider } from "../tiles.interfaces";
import { PropertyChangedEventArgs } from "../../events/events.args";
import { IDisposable, IValidable, Nullable } from "../../types";
import { ISize3 } from "../../geometry";
export type LayerRenderFn<T> = (ctx: CanvasRenderingContext2D, tile: ITile<T>, width: number, height: number) => void;
export interface IDrawableTileMapLayer<T> {
    drawFn?: LayerRenderFn<T>;
    drawTarget?: any;
}
export interface ITileMapLayerOptions<T> extends IDrawableTileMapLayer<T> {
    zindex: number;
    zoomOffset?: number;
    attribution?: string;
}
export declare function isDrawableTileMapLayer<T>(b: unknown): b is IDrawableTileMapLayer<T>;
export interface ITileMapLayer<T> extends IHasActivTiles<T>, ITileMapLayerOptions<T>, ITileMetricsProvider {
    propertyChangedObservable: Observable<PropertyChangedEventArgs<unknown, unknown>>;
    name: string;
    enabled: boolean;
    provider: ITileProvider<T>;
    addTo(map: ITileMapLayerContainer<T, ITileMapLayer<T>> | IHasTileMapLayerContainer<T, ITileMapLayer<T>>): ITileMapLayer<T>;
}
export interface ITileMapLayerView<T, L extends ITileMapLayer<T>> extends ITargetBlock<ITileAddress>, IHasActivTiles<T>, IValidable, IDisposable, ITileMetricsProvider {
    layer: L;
    view: ITileView;
}
export type ImageLayerContentType = HTMLImageElement | HTMLVideoElement | HTMLCanvasElement | ImageBitmap | OffscreenCanvas;
export interface IImageTileMapLayerOptions extends ITileMapLayerOptions<ImageLayerContentType> {
}
export interface IImageTileMapLayer extends ITileMapLayer<ImageLayerContentType>, IImageTileMapLayerOptions {
}
export interface IFloat32TileMapLayer extends ITileMapLayer<Float32Array> {
}
export interface ITileMapLayerContainer<T, L extends ITileMapLayer<T>> {
    layerAddedObservable: Observable<L>;
    layerRemovedObservable: Observable<L>;
    getLayers(predicate?: (k: string, l: L) => boolean, sorted?: boolean): IterableIterator<L>;
    getOrderedLayers(predicate?: (k: string, l: L) => boolean): IterableIterator<L>;
    addLayer(layer: L): void;
    removeLayer(layer: L): void;
    clear(): void;
}
export interface IHasTileMapLayerContainer<T, L extends ITileMapLayer<T>> {
    layerContainer: ITileMapLayerContainer<T, L>;
}
export declare function IsTileMapLayerContainerProxy<T, L extends ITileMapLayer<T>>(b: unknown): b is IHasTileMapLayerContainer<T, L>;
export interface IDisplay extends IDisposable {
    propertyChangedObservable: Observable<PropertyChangedEventArgs<IDisplay, unknown>>;
    resolution: ISize3;
}
export interface IPhysicalDisoplay extends IDisplay {
    dimension: ISize3;
}
export interface IHasDisplay {
    display: Nullable<IDisplay>;
}
export interface ITileMap<T, L extends ITileMapLayer<T>, S> extends ITileMapLayerContainer<T, L>, ITileNavigationApi<S>, IHasNavigationState, IHasDisplay, IDisposable {
    propertyChangedObservable: Observable<PropertyChangedEventArgs<ITileMap<T, L, S>, unknown>>;
}
