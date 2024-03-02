import { Observable } from "../../events/events.observable";
import { ITileNavigationApi, ITileNavigationState } from "../navigation/tiles.navigation.interfaces";
import { ITileConsumer, ITilePipeline, ITilePipelineBuilder, ITileSelectionContext } from "../pipeline/tiles.pipeline.interfaces";
import { IHasActivTiles, ITileMetrics, ITileMetricsProvider, ITileProvider, ITileProviderBuilder } from "../tiles.interfaces";
import { PropertyChangedEventArgs } from "../../events/events.args";
import { IDisposable, IValidable } from "../../types";
export interface ITileDisplay extends IDisposable {
    propertyChangedObservable?: Observable<PropertyChangedEventArgs<ITileDisplay, unknown>>;
    displayHeight: number;
    displayWidth: number;
    ratio: number;
}
export interface ITileMapLayerOptions {
    zindex: number;
    zoomOffset?: number;
    attribution?: string;
}
export interface ITileMapLayer<T> extends IHasActivTiles<T>, ITileConsumer<T>, ITileMapLayerOptions, ITileMetricsProvider, IValidable, ITileSelectionContext {
    propertyChangedObservable: Observable<PropertyChangedEventArgs<unknown, unknown>>;
    name: string;
    enabled: boolean;
    addTo(map: ITileMap<T, ITileMapLayer<T>, unknown>): ITileMapLayer<T>;
}
export interface IImageTileMapLayerOptions extends ITileMapLayerOptions {
    alpha: number;
}
export interface IImageTileMapLayer extends ITileMapLayer<HTMLImageElement>, IImageTileMapLayerOptions {
}
export interface IFloat32TileMapLayer extends ITileMapLayer<Float32Array> {
}
export interface ITileMapLayerBuilder<T, L extends ITileMapLayer<T>> {
    name: string;
    withName(name: string): ITileMapLayerBuilder<T, L>;
    withOptions<O extends ITileMapLayerOptions>(options?: O): ITileMapLayerBuilder<T, L>;
    withZIndex(zindex: number): ITileMapLayerBuilder<T, L>;
    withAlpha(value: number): ITileMapLayerBuilder<T, L>;
    withzoomOffset(value: number): ITileMapLayerBuilder<T, L>;
    withAttribution(value: string): ITileMapLayerBuilder<T, L>;
    withProvider(provider: ITileProvider<T> | ITileProviderBuilder<T>): ITileMapLayerBuilder<T, L>;
    withEnabled(enabled: boolean): ITileMapLayerBuilder<T, L>;
    build(): L;
}
export declare function IsTileMapLayerBuilder<T, L extends ITileMapLayer<T>>(b: unknown): b is ITileMapLayerBuilder<T, L>;
export interface ITileMap<T, L extends ITileMapLayer<T>, S> extends ITileNavigationApi<S>, IDisposable {
    layerAddedObservable: Observable<L>;
    layerRemovedObservable: Observable<L>;
    navigation: ITileNavigationState;
    getLayers(predicate?: (l: L) => boolean, sorted?: boolean): IterableIterator<L>;
    addLayer(layer: L): void;
    removeLayer(layer: L): void;
}
export interface ITileMapBuilder<T, L extends ITileMapLayer<T>> {
    withName(name: string): ITileMapBuilder<T, L>;
    withNavigation(navigation: ITileNavigationState | ITileMetrics): ITileMapBuilder<T, L>;
    withPipeline(pipeline: ITilePipeline<T> | ITilePipelineBuilder<T>): ITileMapBuilder<T, L>;
    withLayer(...layer: Array<L | ITileMapLayerBuilder<T, L>>): ITileMapBuilder<T, L>;
    build(): ITileMap<T, L, unknown> | undefined;
}
