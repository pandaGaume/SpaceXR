import * as BABYLON from "@babylonjs/core";
import * as GUI from "@babylonjs/gui";
import { Observable, Observer, PropertyChangedEventArgs } from "core/events";
import { IGeo2 } from "core/geography";
import { Size2 } from "core/geometry";
import { Context2DTileMap, InputsNavigationTarget } from "core/map";
import { IImageTileMapLayer, ITileDisplayBounds, ITileMap, ITileMetrics, ITileNavigationApi, ITileNavigationState, ImageLayer } from "core/tiles";
import { Nullable } from "core/types";
import { ControlInputController } from "./control.inputs";
import { RGBAColor } from "core/math";
import { ICanvasRenderingOptions } from "core/engine/icanvas";
export type ControlTileContentType = HTMLImageElement;
export interface IMapControlOptions extends ICanvasRenderingOptions {
    navigationManager?: InputsNavigationTarget<MapControl>;
    inputController?: ControlInputController<MapControl>;
}
export declare class MapControl extends GUI.Container implements ITileDisplayBounds, ITileNavigationApi<MapControl>, ITileMap<ControlTileContentType, IImageTileMapLayer, MapControl> {
    static DefaultBackground: RGBAColor;
    static DefaultOptions: ICanvasRenderingOptions;
    _propertyChangedObservable?: Observable<PropertyChangedEventArgs<ITileDisplayBounds, unknown>>;
    _map: Context2DTileMap;
    _mapValidationObserver: Nullable<Observer<boolean>>;
    _cachedMeasure: Size2;
    _navigationManager: InputsNavigationTarget<MapControl>;
    _inputController: ControlInputController<MapControl>;
    constructor(name: string, options?: IMapControlOptions, nav?: ITileNavigationState);
    get displayHeight(): number;
    get displayWidth(): number;
    get propertyChangedObservable(): Observable<PropertyChangedEventArgs<ITileDisplayBounds, unknown>>;
    get ratio(): number;
    dispose(): void;
    setViewMap(center: IGeo2 | Array<number>, zoom?: number, rotation?: number): MapControl;
    zoomMap(delta: number): MapControl;
    zoomInMap(delta: number): MapControl;
    zoomOutMap(delta: number): MapControl;
    translateUnitsMap(tx: number, ty: number, metrics?: ITileMetrics): MapControl;
    translateMap(lat: IGeo2 | Array<number> | number, lon?: number): MapControl;
    rotateMap(r: number): MapControl;
    get navigation(): ITileNavigationState;
    get layerAddedObservable(): Observable<IImageTileMapLayer>;
    get layerRemovedObservable(): Observable<IImageTileMapLayer>;
    getLayers(predicate?: (l: IImageTileMapLayer) => boolean, sorted?: boolean): IterableIterator<IImageTileMapLayer>;
    addLayer(layer: ImageLayer): void;
    removeLayer(layer: ImageLayer): void;
    private _onMapValidation;
    protected _additionalProcessing(parentMeasure: GUI.Measure, context: BABYLON.ICanvasRenderingContext): void;
    protected _localDraw(context: BABYLON.ICanvasRenderingContext): void;
}
