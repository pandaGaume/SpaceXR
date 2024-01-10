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
    name: string; // provide access to the underlying name for uniquely identify the intended layer
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

export function IsTileMapLayerBuilder<T>(b: unknown): b is ITileMapLayerBuilder<T> {
    if (b === null || typeof b !== "object") return false;
    return (
        (<ITileMapLayerBuilder<T>>b).build !== undefined &&
        (<ITileMapLayerBuilder<T>>b).withName !== undefined &&
        (<ITileMapLayerBuilder<T>>b).withZIndex !== undefined &&
        (<ITileMapLayerBuilder<T>>b).withProvider !== undefined &&
        (<ITileMapLayerBuilder<T>>b).withEnabled !== undefined
    );
}

/// <summary>
/// Interface for a tile map. A logical tile map is caraterized by a display, a navigation api and a pipeline.
/// The display is the target of the map, it is where the tiles are displayed.
/// The navigation api is the source of the map, it is where the map is navigating. The navigation api is also responsible for the metrics.
/// The pipeline is the link between the display and the navigation api. It is responsible for selecting the tiles to display.
/// Note we may have several views on the same map. This is a Pipeline feature which allow advanced use case. Commonly, we will have only one view.
/// when adding a view to a map, the map will set the display and the navigation api of the view.
/// When removing a view, the map will clear the display and the navigation api of this view.
/// Changing the display or the navigation api of a map will automatically update the display or the navigation api of all the views.
/// </summary>
export interface ITileMap<T> extends ITileNavigationApi<unknown>, IDisposable {
    // map related
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
