import * as BABYLON from "@babylonjs/core";
import * as GUI from "@babylonjs/gui";
import { Observable, Observer, PropertyChangedEventArgs } from "core/events";
import { IGeo2 } from "core/geography";
import { Size2 } from "core/geometry";
import { Context2DTileMap, ICanvasRenderingOptions, InputsNavigationTarget } from "core/map";
import { ITileDisplay, ITileMap, ITileMapLayer, ITileMetrics, ITileNavigationApi, ITileNavigationState } from "core/tiles";
import { Nullable } from "core/types";
import { ControlInputController } from "./control.inputs";
import { RGBAColor } from "core/math";
export type ControlTileContentType = HTMLImageElement;
export interface IMapControlOptions extends ICanvasRenderingOptions {
    navigationManager?: InputsNavigationTarget<MapControl>;
    inputController?: ControlInputController<MapControl>;
}
export declare class MapControl extends GUI.Container implements ITileDisplay, ITileNavigationApi<MapControl>, ITileMap<ControlTileContentType> {
    static DefaultBackground: RGBAColor;
    static DefaultOptions: ICanvasRenderingOptions;
    _propertyChangedObservable?: Observable<PropertyChangedEventArgs<ITileDisplay, unknown>>;
    _map: Context2DTileMap;
    _mapValidationObserver: Nullable<Observer<boolean>>;
    _cachedMeasure: Size2;
    _navigationManager: InputsNavigationTarget<MapControl>;
    _inputController: ControlInputController<MapControl>;
    constructor(name: string, options?: IMapControlOptions, nav?: ITileNavigationState);
    get displayHeight(): number;
    get displayWidth(): number;
    get propertyChangedObservable(): Observable<PropertyChangedEventArgs<ITileDisplay, unknown>>;
    dispose(): void;
    setView(center: IGeo2 | Array<number>, zoom?: number, rotation?: number): MapControl;
    zooming(delta: number): MapControl;
    zoomIn(delta: number): MapControl;
    zoomOut(delta: number): MapControl;
    translatePixel(tx: number, ty: number, metrics?: ITileMetrics): MapControl;
    translate(lat: IGeo2 | Array<number> | number, lon?: number): MapControl;
    rotate(r: number): MapControl;
    get navigation(): ITileNavigationState;
    get layerAddedObservable(): Observable<ITileMapLayer<ControlTileContentType>>;
    get layerRemovedObservable(): Observable<ITileMapLayer<ControlTileContentType>>;
    getLayers(predicate?: (l: ITileMapLayer<ControlTileContentType>) => boolean, sorted?: boolean): IterableIterator<ITileMapLayer<ControlTileContentType>>;
    addLayer(layer: ITileMapLayer<ControlTileContentType>): void;
    removeLayer(layer: ITileMapLayer<ControlTileContentType>): void;
    private onMapValidation;
    protected _additionalProcessing(parentMeasure: GUI.Measure, context: BABYLON.ICanvasRenderingContext): void;
    protected _localDraw(context: BABYLON.ICanvasRenderingContext): void;
}
