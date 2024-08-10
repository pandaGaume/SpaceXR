import { Observable } from "../../events/events.observable";
import { IHasNavigationState, ITileNavigationApi } from "../navigation/tiles.navigation.interfaces";
import { IHasView, ITargetBlock, ITileSelectionContext } from "../pipeline/tiles.pipeline.interfaces";
import { IHasActivTiles, ITile, ITileAddress, ITileMetricsProvider, ITileProvider } from "../tiles.interfaces";
import { PropertyChangedEventArgs } from "../../events/events.args";
import { IDisposable, IValidable, Nullable } from "../../types";
import { ISize3 } from "../../geometry";

export type LayerRenderFn<T> = (ctx: CanvasRenderingContext2D, tile: ITile<T>, width: number, height: number) => void;

export interface IDrawableTileMapLayer<T> {
    drawFn?: LayerRenderFn<T>;
    drawTarget?: any; // target of the draw call, the layer itself if undefined. Default is undefined.
}

export interface ITileMapLayerOptions<T> extends IDrawableTileMapLayer<T> {
    zindex: number;
    zoomOffset?: number;
    attribution?: string;
}

export function isDrawableTileMapLayer<T>(b: unknown): b is IDrawableTileMapLayer<T> {
    if (b === null || typeof b !== "object") return false;
    return (<IDrawableTileMapLayer<T>>b).drawFn !== undefined;
}

export interface ITileMapLayer<T> extends IHasActivTiles<T>, ITileMapLayerOptions<T>, ITileMetricsProvider {
    propertyChangedObservable: Observable<PropertyChangedEventArgs<unknown, unknown>>;
    name: string;
    enabled: boolean;
    provider: ITileProvider<T>;
    addTo(map: ITileMapLayerContainer<T> | IHasTileMapLayerContainer<T>): ITileMapLayer<T>;
}

export interface ITileMapLayerProxy<T> extends IHasActivTiles<T>, IValidable {
    name: string;
    layer: ITileMapLayer<T>;
    zindex?: number;
}

export function isTileMapLayerProxy<T>(b: unknown): b is ITileMapLayerProxy<T> {
    if (b === null || typeof b !== "object") return false;
    return (<ITileMapLayerProxy<T>>b).layer !== undefined;
}

export interface ITileMapLayerView<T>
    extends ITileMapLayerProxy<T>,
        ITargetBlock<ITileAddress>,
        IHasActivTiles<T>,
        IValidable,
        IDisposable,
        ITileMetricsProvider,
        IHasView,
        ITileSelectionContext {}

export type ImageLayerContentType = HTMLImageElement | HTMLVideoElement | HTMLCanvasElement | ImageBitmap | OffscreenCanvas;

export interface IImageTileMapLayerOptions extends ITileMapLayerOptions<ImageLayerContentType> {}

export interface IImageTileMapLayer extends ITileMapLayer<ImageLayerContentType>, IImageTileMapLayerOptions {}

export interface IFloat32TileMapLayer extends ITileMapLayer<Float32Array> {}

export type TileMapLayerContainerContentType<T> = ITileMapLayer<T> | ITileMapLayerProxy<T>;

export interface ITileMapLayerContainer<T> {
    layerAddedObservable: Observable<TileMapLayerContainerContentType<T>>;
    layerRemovedObservable: Observable<TileMapLayerContainerContentType<T>>;

    getLayers(predicate?: (k: string, l: TileMapLayerContainerContentType<T>) => boolean, sorted?: boolean): IterableIterator<TileMapLayerContainerContentType<T>>;
    getOrderedLayers(predicate?: (k: string, l: TileMapLayerContainerContentType<T>) => boolean): IterableIterator<TileMapLayerContainerContentType<T>>;

    addLayer(layer: TileMapLayerContainerContentType<T>): void;
    removeLayer(layer: TileMapLayerContainerContentType<T>): void;
    clear(): void;
}

export interface IHasTileMapLayerContainer<T> {
    layerContainer: ITileMapLayerContainer<T>;
}

export function IsTileMapLayerContainerProxy<T>(b: unknown): b is IHasTileMapLayerContainer<T> {
    if (b === null || typeof b !== "object") return false;
    return (<IHasTileMapLayerContainer<T>>b).layerContainer !== undefined;
}

export interface IDisplay extends IDisposable {
    propertyChangedObservable: Observable<PropertyChangedEventArgs<IDisplay, unknown>>;
    resolution: ISize3;
}

export interface IPhysicalDisplay extends IDisplay {
    dimension: ISize3;
}

export interface IHasDisplay {
    display: Nullable<IDisplay>;
}

export interface ITileMap<T, L extends ITileMapLayer<T>, S> extends ITileMapLayerContainer<T>, ITileNavigationApi<S>, IHasNavigationState, IHasDisplay, IDisposable {}
