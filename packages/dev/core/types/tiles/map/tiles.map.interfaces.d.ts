import { Observable } from "../../events/events.observable";
import { ITileNavigationApi } from "../navigation/tiles.navigation.interfaces";
import { ITileConsumer, ITilePipeline, ITilePipelineBuilder } from "../pipeline/tiles.pipeline.interfaces";
import { ITileDisplay, ITileMetrics, ITileMetricsProvider, ITileProvider, ITileProviderBuilder } from "../tiles.interfaces";
import { PropertyChangedEventArgs } from "../../events/events.args";
import { Nullable } from "../../types";
export interface ITileMapLayerOptions {
    zindex: number;
    alpha: number;
    zoomOffset?: number;
    attribution?: string;
}
export interface ITileMapLayer<T> extends ITileMapLayerOptions, ITileMetricsProvider {
    propertyChangedObservable: Observable<PropertyChangedEventArgs<ITileMapLayer<T>, unknown>>;
    name: string;
    provider: ITileProvider<T>;
    enabled: boolean;
    addTo(map: ITileMap<T>): ITileMapLayer<T>;
}
export interface ITileMapLayerBuilder<T> {
    name: string;
    withName(name: string): ITileMapLayerBuilder<T>;
    withOptions(options?: ITileMapLayerOptions): ITileMapLayerBuilder<T>;
    withZIndex(zindex: number): ITileMapLayerBuilder<T>;
    withAlpha(value: number): ITileMapLayerBuilder<T>;
    withzoomOffset(value: number): ITileMapLayerBuilder<T>;
    withAttribution(value: string): ITileMapLayerBuilder<T>;
    withProvider(provider: ITileProvider<T> | ITileProviderBuilder<T>): ITileMapLayerBuilder<T>;
    withEnabled(enabled: boolean): ITileMapLayerBuilder<T>;
    build(): ITileMapLayer<T>;
}
export declare function IsTileMapLayerBuilder<T>(b: unknown): b is ITileMapLayerBuilder<T>;
export interface ITileMap<T> extends ITileConsumer<T>, ITileNavigationApi<unknown> {
    layerAddedObservable: Observable<ITileMapLayer<T>>;
    layerRemovedObservable: Observable<ITileMapLayer<T>>;
    display: Nullable<ITileDisplay>;
    navigation: ITileNavigationApi<unknown>;
    getLayers(predicate?: (l: ITileMapLayer<T>) => boolean, sorted?: boolean): IterableIterator<ITileMapLayer<T>>;
    addLayer(layer: ITileMapLayer<T>): void;
    removeLayer(layer: ITileMapLayer<T>): void;
    pipeline: ITilePipeline<T>;
}
export interface ITileMapBuilder<T> {
    withName(name: string): ITileMapBuilder<T>;
    withDisplay(display: ITileDisplay): ITileMapBuilder<T>;
    withNavigation(navigation: ITileNavigationApi<unknown> | ITileMetrics): ITileMapBuilder<T>;
    withPipeline(pipeline: ITilePipeline<T> | ITilePipelineBuilder<T>): ITileMapBuilder<T>;
    withLayer(...layer: Array<ITileMapLayer<T> | ITileMapLayerBuilder<T>>): ITileMapBuilder<T>;
    build(): ITileMap<T> | undefined;
}
