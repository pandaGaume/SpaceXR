import * as BABYLON from "@babylonjs/core";
import { CanvasDisplay, CanvasMap, ICanvasRenderingOptions } from "core/map/canvas";
import { IImageTileMapLayer, ITileMap, ITileMetrics, ITileNavigationApi, ITileNavigationState, ImageLayer } from "core/tiles";
import { ISize2 } from "core/geometry";
import { IGeo2 } from "core/geography";
import { Observable, Observer } from "core/events";
export interface IMapTextureOptions extends ICanvasRenderingOptions, ISize2 {
    generateMipMaps?: boolean;
    samplingMode?: number;
    format?: number;
    invertY?: boolean;
}
export declare class MapTexture extends BABYLON.Texture implements ITileNavigationApi<MapTexture>, ITileMap<HTMLImageElement, IImageTileMapLayer> {
    static readonly DefaultOptions: IMapTextureOptions;
    static Options(width: number, height?: number): IMapTextureOptions;
    static OptionsHD(): IMapTextureOptions;
    static OptionsFullHD(): IMapTextureOptions;
    static Options4K(): IMapTextureOptions;
    static Options8K(): IMapTextureOptions;
    _display: BABYLON.Nullable<CanvasDisplay>;
    _map: BABYLON.Nullable<CanvasMap>;
    _mapValidationObserver: BABYLON.Nullable<Observer<boolean>>;
    constructor(name: string, options: IMapTextureOptions, scene: BABYLON.Scene, nav?: ITileNavigationState);
    setView(center: IGeo2 | Array<number>, zoom?: number, rotation?: number): MapTexture;
    zooming(delta: number): MapTexture;
    zoomIn(delta: number): MapTexture;
    zoomOut(delta: number): MapTexture;
    translatePixel(tx: number, ty: number, metrics?: ITileMetrics): MapTexture;
    translate(lat: IGeo2 | Array<number> | number, lon?: number): MapTexture;
    rotate(r: number): MapTexture;
    get navigation(): ITileNavigationState;
    get layerAddedObservable(): Observable<IImageTileMapLayer>;
    get layerRemovedObservable(): Observable<IImageTileMapLayer>;
    getLayers(predicate?: (l: IImageTileMapLayer) => boolean, sorted?: boolean): IterableIterator<IImageTileMapLayer>;
    addLayer(layer: ImageLayer): void;
    removeLayer(layer: ImageLayer): void;
    private onMapValidation;
}
