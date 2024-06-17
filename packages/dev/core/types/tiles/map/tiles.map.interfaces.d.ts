import { Observable } from "../../events/events.observable";
import { IHasNavigationState, ITileNavigationApi, ITileNavigationState } from "../navigation/tiles.navigation.interfaces";
import { ITileConsumer, ITilePipeline, ITilePipelineBuilder, ITileSelectionContext } from "../pipeline/tiles.pipeline.interfaces";
import { IHasActivTiles, ITile, ITileMetrics, ITileMetricsProvider, ITileProvider, ITileProviderBuilder } from "../tiles.interfaces";
import { PropertyChangedEventArgs } from "../../events/events.args";
import { IDisposable, IValidable } from "../../types";
import { ICanvasRenderingOptions } from "../../engine/icanvas";
import { ISize2 } from "../../geometry";
import { IShape } from "../../geometry/shapes/geometry.shapes.interfaces";
export interface ITileDisplayBounds extends ISize2, IDisposable {
    propertyChangedObservable?: Observable<PropertyChangedEventArgs<ITileDisplayBounds, unknown>>;
    ratio?: number;
}
export interface ITileMapLayerOptions {
    zindex: number;
    zoomOffset?: number;
    attribution?: string;
}
export interface IDrawableTileMapLayer<T> {
    draw(context: CanvasRenderingContext2D, tile: ITile<T>): void;
}
export interface ITileMapLayer<T> extends IHasActivTiles<T>, ITileConsumer<T>, ITileMapLayerOptions, ITileMetricsProvider, IValidable, ITileSelectionContext, IHasNavigationState {
    propertyChangedObservable: Observable<PropertyChangedEventArgs<unknown, unknown>>;
    name: string;
    enabled: boolean;
    addTo(map: ITileMapLayerContainer<T, ITileMapLayer<T>> | IHasTileMapLayerContainer<T, ITileMapLayer<T>>): ITileMapLayer<T>;
}
export interface IImageTileMapLayerOptions extends ITileMapLayerOptions, ICanvasRenderingOptions {
}
export interface IImageTileMapLayer extends ITileMapLayer<HTMLImageElement | ImageData>, IImageTileMapLayerOptions {
}
export interface IFloat32TileMapLayer extends ITileMapLayer<Float32Array> {
}
export interface IShapeLayer extends ITileMapLayer<Array<IShape>>, IDrawableTileMapLayer<Array<IShape>> {
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
export interface ITileMapLayerContainer<T, L extends ITileMapLayer<T>> {
    layerAddedObservable: Observable<L>;
    layerRemovedObservable: Observable<L>;
    getLayers(predicate?: (l: L) => boolean, sorted?: boolean): IterableIterator<L>;
    getOrderedLayers(predicate?: (l: L) => boolean): IterableIterator<L>;
    addLayer(layer: L): void;
    removeLayer(layer: L): void;
    clear(): void;
}
export interface IHasTileMapLayerContainer<T, L extends ITileMapLayer<T>> {
    layerContainer: ITileMapLayerContainer<T, L>;
}
export declare function IsTileMapLayerContainerProxy<T, L extends ITileMapLayer<T>>(b: unknown): b is IHasTileMapLayerContainer<T, L>;
export interface ITileMap<T, L extends ITileMapLayer<T>, S> extends ITileMapLayerContainer<T, L>, ITileNavigationApi<S>, IHasNavigationState, IDisposable {
}
export interface ITileMapBuilder<T, L extends ITileMapLayer<T>> {
    withName(name: string): ITileMapBuilder<T, L>;
    withNavigation(navigation: ITileNavigationState | ITileMetrics): ITileMapBuilder<T, L>;
    withPipeline(pipeline: ITilePipeline<T> | ITilePipelineBuilder<T>): ITileMapBuilder<T, L>;
    withLayer(...layer: Array<L | ITileMapLayerBuilder<T, L>>): ITileMapBuilder<T, L>;
    build(): ITileMap<T, L, unknown> | undefined;
}
