import { Observable } from "../../events/events.observable";
import { ITileNavigationApi, ITileNavigationState } from "../navigation/tiles.navigation.interfaces";
import { ITileConsumer, ITilePipeline, ITilePipelineBuilder, ITileSelectionContext } from "../pipeline/tiles.pipeline.interfaces";
import { ITileDisplay, ITileMetrics, ITileMetricsProvider, ITileProvider, ITileProviderBuilder } from "../tiles.interfaces";
import { PropertyChangedEventArgs } from "../../events/events.args";
import { IDisposable, IValidable, Nullable } from "../../types";
export interface ITileMapLayerOptions {
    zindex: number;
    alpha: number;
    zoomOffset?: number;
    attribution?: string;
}
export interface ITileMapLayer<T> extends ITileConsumer<T>, ITileMapLayerOptions, ITileMetricsProvider, IValidable<unknown>, ITileSelectionContext {
    propertyChangedObservable: Observable<PropertyChangedEventArgs<unknown, unknown>>;
    name: string;
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
export interface ITileMap<T> extends ITileNavigationApi<unknown>, IDisposable {
    layerAddedObservable: Observable<ITileMapLayer<T>>;
    layerRemovedObservable: Observable<ITileMapLayer<T>>;
    display: Nullable<ITileDisplay>;
    navigation: ITileNavigationState;
    getLayers(predicate?: (l: ITileMapLayer<T>) => boolean, sorted?: boolean): IterableIterator<ITileMapLayer<T>>;
    addLayer(layer: ITileMapLayer<T>): void;
    removeLayer(layer: ITileMapLayer<T>): void;
}
export interface ITileMapBuilder<T> {
    withName(name: string): ITileMapBuilder<T>;
    withDisplay(display: ITileDisplay): ITileMapBuilder<T>;
    withNavigation(navigation: ITileNavigationState | ITileMetrics): ITileMapBuilder<T>;
    withPipeline(pipeline: ITilePipeline<T> | ITilePipelineBuilder<T>): ITileMapBuilder<T>;
    withLayer(...layer: Array<ITileMapLayer<T> | ITileMapLayerBuilder<T>>): ITileMapBuilder<T>;
    build(): ITileMap<T> | undefined;
}
