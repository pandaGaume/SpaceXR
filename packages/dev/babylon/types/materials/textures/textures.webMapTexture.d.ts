import * as BABYLON from "@babylonjs/core";
import { CanvasDisplay, CanvasMap } from "core/map/canvas";
import { IImageTileMapLayer, ITileMap, ITileMetrics, ITileNavigationApi, ITileNavigationState, ImageLayer } from "core/tiles";
import { ISize2 } from "core/geometry";
import { IGeo2 } from "core/geography";
import { EventState, Observable } from "core/events";
import { ICanvasRenderingOptions } from "core/engine";
export interface IMapTextureOptions extends ICanvasRenderingOptions, ISize2 {
    generateMipMaps?: boolean;
    samplingMode?: number;
    format?: number;
    invertY?: boolean;
}
export declare class WebMapTexture extends BABYLON.Texture implements ITileNavigationApi<WebMapTexture>, ITileMap<HTMLImageElement, IImageTileMapLayer, WebMapTexture> {
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
    setViewMap(center: IGeo2 | Array<number>, zoom?: number, rotation?: number): WebMapTexture;
    zoomMap(delta: number): WebMapTexture;
    zoomInMap(delta: number): WebMapTexture;
    zoomOutMap(delta: number): WebMapTexture;
    translateUnitsMap(tx: number, ty: number, metrics?: ITileMetrics): WebMapTexture;
    translateMap(lat: IGeo2 | Array<number> | number, lon?: number): WebMapTexture;
    rotateMap(r: number): WebMapTexture;
    get navigation(): ITileNavigationState;
    get display(): BABYLON.Nullable<CanvasDisplay>;
    get layerAddedObservable(): Observable<IImageTileMapLayer>;
    get layerRemovedObservable(): Observable<IImageTileMapLayer>;
    getLayers(predicate?: (l: IImageTileMapLayer) => boolean, sorted?: boolean): IterableIterator<IImageTileMapLayer>;
    addLayer(layer: ImageLayer): void;
    removeLayer(layer: ImageLayer): void;
    dispose(): void;
    protected _checkUpdate(camera: BABYLON.Camera, eventState: EventState): void;
}
