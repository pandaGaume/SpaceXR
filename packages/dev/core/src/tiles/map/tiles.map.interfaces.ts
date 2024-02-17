import { Observable } from "../../events/events.observable";
import { ITileNavigationApi, ITileNavigationState } from "../navigation/tiles.navigation.interfaces";
import { ITileConsumer, ITilePipeline, ITilePipelineBuilder, ITileSelectionContext } from "../pipeline/tiles.pipeline.interfaces";
import { ITileAddress, ITileDatasource, ITileMetrics, ITileMetricsProvider, ITileProvider, ITileProviderBuilder } from "../tiles.interfaces";
import { PropertyChangedEventArgs } from "../../events/events.args";
import { IDisposable, IValidable } from "../../types";

/// <summary>
/// Provide Unitless target size
/// </summary>
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

export interface ITileMapLayer<T> extends ITileConsumer<T>, ITileMapLayerOptions, ITileMetricsProvider, IValidable, ITileSelectionContext {
    propertyChangedObservable: Observable<PropertyChangedEventArgs<unknown, unknown>>;
    name: string;
    enabled: boolean;

    addTo(map: ITileMap<T, ITileMapLayer<T>>): ITileMapLayer<T>;
}

export interface ICompoundLayerDataSource<T> extends ITileDatasource<T, ITileAddress> {
    layers: Array<ITileMapLayer<T>>;
}

export interface IImageTileMapLayerOptions extends ITileMapLayerOptions {
    alpha: number;
}


export interface IImageTileMapLayer extends ITileMapLayer<HTMLImageElement>, IImageTileMapLayerOptions {}

export interface IFloat32TileMapLayer extends ITileMapLayer<Float32Array> {}

export interface ITileMapLayerBuilder<T, L extends ITileMapLayer<T>> {
    name: string; // provide access to the underlying name for uniquely identify the intended layer
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

export function IsTileMapLayerBuilder<T, L extends ITileMapLayer<T>>(b: unknown): b is ITileMapLayerBuilder<T, L> {
    if (b === null || typeof b !== "object") return false;
    return (
        (<ITileMapLayerBuilder<T, L>>b).build !== undefined &&
        (<ITileMapLayerBuilder<T, L>>b).withName !== undefined &&
        (<ITileMapLayerBuilder<T, L>>b).withZIndex !== undefined &&
        (<ITileMapLayerBuilder<T, L>>b).withProvider !== undefined &&
        (<ITileMapLayerBuilder<T, L>>b).withEnabled !== undefined
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
export interface ITileMap<T, L extends ITileMapLayer<T>> extends ITileNavigationApi<unknown>, IDisposable {
    // map related
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
    build(): ITileMap<T, L> | undefined;
}
