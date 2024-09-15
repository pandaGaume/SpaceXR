import { Observable } from "../../events/events.observable";
import { IHasNavigationApi, IHasNavigationState, ITileNavigationApi } from "../navigation/tiles.navigation.interfaces";
import { IHasView } from "../pipeline/tiles.pipeline.interfaces";
import { IHasActivTiles, ITile, ITileContentProvider, ITileMetricsProvider, ITileProvider } from "../tiles.interfaces";
import { PropertyChangedEventArgs } from "../../events/events.args";
import { IDisposable, IValidable, Nullable } from "../../types";
import { ICartesian3, ISize3 } from "../../geometry";
import { IOrderedCollection, IWeighted } from "../../collections/collections.interfaces";
export type LayerRenderFn<T> = (ctx: CanvasRenderingContext2D, tile: ITile<T>, width: number, height: number) => void;
export interface IDrawableTileMapLayer<T> {
    drawFn?: LayerRenderFn<T>;
    drawTarget?: any;
}
export interface ITileMapLayerOptions<T> extends IDrawableTileMapLayer<T> {
    weight?: number;
    zoomOffset?: number;
    attribution?: string;
}
export declare function IsDrawableTileMapLayer<T>(b: unknown): b is IDrawableTileMapLayer<T>;
export interface ITileMapLayer<T> extends ITileMapLayerOptions<T>, ITileMetricsProvider, IWeighted {
    propertyChangedObservable: Observable<PropertyChangedEventArgs<unknown, unknown>>;
    name: string;
    enabled: boolean;
    provider: ITileContentProvider<T>;
    addTo(map: ITileMapLayerContainer<T> | IHasTileMapLayerContainer<T>): ITileMapLayer<T>;
}
export declare function IsTileMapLayer<T>(b: unknown): b is ITileMapLayer<T>;
export interface ITileMapLayerProxy<T> extends IHasActivTiles<T>, IValidable {
    layer: ITileMapLayer<T>;
}
export declare function IsTileMapLayerProxy<T>(b: unknown): b is ITileMapLayerProxy<T>;
export type ImageLayerContentType = HTMLImageElement | HTMLVideoElement | HTMLCanvasElement | ImageBitmap | OffscreenCanvas;
export interface IImageTileMapLayerOptions extends ITileMapLayerOptions<ImageLayerContentType> {
}
export interface IImageTileMapLayer extends ITileMapLayer<ImageLayerContentType>, IImageTileMapLayerOptions {
}
export interface IFloat32TileMapLayer extends ITileMapLayer<Float32Array> {
}
export interface ITileMapLayerContainer<T> extends IOrderedCollection<ITileMapLayer<T>> {
}
export interface IHasTileMapLayerContainer<T> {
    layers: ITileMapLayerContainer<T>;
}
export declare function IsTileMapLayerContainerProxy<T>(b: unknown): b is IHasTileMapLayerContainer<T>;
export interface IDisplay extends IDisposable {
    propertyChangedObservable: Observable<PropertyChangedEventArgs<IDisplay, unknown>>;
    resolution: ISize3;
}
export interface IPhysicalDisplay extends IDisplay {
    dimension: ISize3;
    pixelPerUnit: ICartesian3;
    dpi: number;
}
export declare function IsPhysicalDisplay(b: unknown): b is IPhysicalDisplay;
export interface IHasDisplay {
    display: Nullable<IDisplay>;
}
export interface ITileMapCoreProperties extends IHasDisplay, IHasNavigationState, IHasView {
}
export interface ITileMap<T> extends IHasTileMapLayerContainer<T>, IHasTileMapLayerViewContainer<T>, ITileNavigationApi, ITileMapCoreProperties, IDisposable {
}
export interface ITileMapLayerView<T> extends ITileMapLayerProxy<T>, ITileProvider<T>, IValidable, ITileMapCoreProperties, IWeighted, IHasNavigationApi {
}
export interface ITileMapLayerViewContainer<T> extends IOrderedCollection<ITileMapLayerView<T>> {
}
export interface IHasTileMapLayerViewContainer<T> {
    layerViews: ITileMapLayerViewContainer<T>;
}
