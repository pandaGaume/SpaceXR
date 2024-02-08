import * as BABYLON from "@babylonjs/core";
import { CanvasDisplay, CanvasMap, ICanvasRenderingOptions } from "core/map/canvas";
import { IImageTileMapLayer, IPipelineMessageType, ITile, ITileMap, ITileMetrics, ITileNavigationApi, ITileNavigationState, ImageLayer } from "core/tiles";
import { ISize2 } from "core/geometry";
import { IGeo2 } from "core/geography";
import { EventState, Observable } from "core/events";
export interface IMapTextureOptions extends ICanvasRenderingOptions, ISize2 {
    generateMipMaps?: boolean;
    samplingMode?: number;
    format?: number;
    invertY?: boolean;
}
export declare class MapTexture extends BABYLON.Texture implements ITileNavigationApi<MapTexture>, ITileMap<HTMLImageElement, IImageTileMapLayer> {
    static readonly DefaultOptions: IMapTextureOptions;
    static Options(o?: Partial<IMapTextureOptions>): IMapTextureOptions;
    static OptionsHD(o?: Partial<IMapTextureOptions>): IMapTextureOptions;
    static OptionsFullHD(o?: Partial<IMapTextureOptions>): IMapTextureOptions;
    static Options4K(o?: Partial<IMapTextureOptions>): IMapTextureOptions;
    static Options8K(o?: Partial<IMapTextureOptions>): IMapTextureOptions;
    _display: BABYLON.Nullable<CanvasDisplay>;
    _map: BABYLON.Nullable<CanvasMap>;
    _renderObserver: BABYLON.Nullable<BABYLON.Observer<BABYLON.Camera>>;
    constructor(name: string, options: IMapTextureOptions, scene: BABYLON.Scene, nav?: ITileNavigationState);
    get map(): BABYLON.Nullable<CanvasMap>;
    setView(center: IGeo2 | Array<number>, zoom?: number, rotation?: number): MapTexture;
    zooming(delta: number): MapTexture;
    zoomIn(delta: number): MapTexture;
    zoomOut(delta: number): MapTexture;
    translatePixel(tx: number, ty: number, metrics?: ITileMetrics): MapTexture;
    translate(lat: IGeo2 | Array<number> | number, lon?: number): MapTexture;
    rotate(r: number): MapTexture;
    get navigation(): ITileNavigationState;
    get display(): BABYLON.Nullable<CanvasDisplay>;
    get layerAddedObservable(): Observable<IImageTileMapLayer>;
    get layerRemovedObservable(): Observable<IImageTileMapLayer>;
    getLayers(predicate?: (l: IImageTileMapLayer) => boolean, sorted?: boolean): IterableIterator<IImageTileMapLayer>;
    addLayer(layer: ImageLayer): void;
    removeLayer(layer: ImageLayer): void;
    dispose(): void;
    protected _checkUpdate(camera: BABYLON.Camera, eventState: EventState): void;
    added(eventData: IPipelineMessageType<ITile<HTMLImageElement>>, eventState: EventState): void;
    removed(eventData: IPipelineMessageType<ITile<HTMLImageElement>>, eventState: EventState): void;
    updated(eventData: IPipelineMessageType<ITile<HTMLImageElement>>, eventState: EventState): void;
    protected _onTileAdded(eventData: Array<ITile<HTMLImageElement>>, eventState: EventState): void;
    protected _onTileRemoved(eventData: Array<ITile<HTMLImageElement>>, eventState: EventState): void;
    protected _onTileUpdated(eventData: Array<ITile<HTMLImageElement>>, eventState: EventState): void;
}
