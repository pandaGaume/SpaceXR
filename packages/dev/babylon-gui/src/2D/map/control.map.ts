import * as BABYLON from "@babylonjs/core";
import * as GUI from "@babylonjs/gui";
import { EventState, Observable, Observer, PropertyChangedEventArgs } from "core/events";
import { IGeo2 } from "core/geography";
import { Size2 } from "core/geometry";
import { Context2DTileMap, ICanvasRenderingOptions, InputsNavigationTarget } from "core/map";
import { IImageTileMapLayer, ITileDisplay, ITileMap, ITileMetrics, ITileNavigationApi, ITileNavigationState, ImageLayer } from "core/tiles";
import { Nullable } from "core/types";
import { ControlInputController } from "./control.inputs";
import { RGBAColor } from "core/math";
import { ICanvasRenderingContext } from "core/engine/icanvas";

export type ControlTileContentType = HTMLImageElement;

export interface IMapControlOptions extends ICanvasRenderingOptions {
    navigationManager?: InputsNavigationTarget<MapControl>;
    inputController?: ControlInputController<MapControl>;
}

export class MapControl extends GUI.Container implements ITileDisplay, ITileNavigationApi<MapControl>, ITileMap<ControlTileContentType, IImageTileMapLayer, MapControl> {
    public static DefaultBackground = RGBAColor.LightGray();

    public static DefaultOptions: ICanvasRenderingOptions = {
        background: MapControl.DefaultBackground.toHexString(),
    };

    _propertyChangedObservable?: Observable<PropertyChangedEventArgs<ITileDisplay, unknown>>;

    _map: Context2DTileMap;
    _mapValidationObserver: Nullable<Observer<boolean>>;
    _cachedMeasure: Size2 = Size2.Zero();

    _navigationManager: InputsNavigationTarget<MapControl>;
    _inputController: ControlInputController<MapControl>;

    public constructor(name: string, options?: IMapControlOptions, nav?: ITileNavigationState) {
        super(name);
        const o = { ...MapControl.DefaultOptions, ...options };
        this._map = new Context2DTileMap(name, this, o, nav);
        this._mapValidationObserver = this._map.validationObservable.add(this._onMapValidation.bind(this));
        this._navigationManager = o.navigationManager ?? new InputsNavigationTarget<MapControl>(this._map);
        this._inputController = o.inputController ?? new ControlInputController<MapControl>(this, this._navigationManager);
    }

    public get displayHeight(): number {
        return this._currentMeasure.height;
    }

    public get displayWidth(): number {
        return this._currentMeasure.width;
    }

    public get propertyChangedObservable(): Observable<PropertyChangedEventArgs<ITileDisplay, unknown>> {
        if (!this._propertyChangedObservable) {
            this._propertyChangedObservable = new Observable<PropertyChangedEventArgs<ITileDisplay, unknown>>();
        }
        return this._propertyChangedObservable;
    }

    public get ratio(): number {
        return this.displayWidth / this.displayHeight;
    }

    public dispose(): void {
        this._mapValidationObserver?.disconnect();
        this._map.dispose();
        super.dispose();
    }

    // navigation related
    public setViewMap(center: IGeo2 | Array<number>, zoom?: number, rotation?: number): MapControl {
        this._map.setViewMap(center, zoom, rotation);
        return this;
    }

    public zoomMap(delta: number): MapControl {
        this._map.zoomMap(delta);
        return this;
    }

    zoomInMap(delta: number): MapControl {
        this._map.zoomInMap(delta);
        return this;
    }
    zoomOutMap(delta: number): MapControl {
        this._map.zoomOutMap(delta);
        return this;
    }
    translatePixelMap(tx: number, ty: number, metrics?: ITileMetrics): MapControl {
        this._map.translatePixelMap(tx, ty, metrics);
        return this;
    }
    translateMap(lat: IGeo2 | Array<number> | number, lon?: number): MapControl {
        this._map.translateMap(lat, lon);
        return this;
    }
    rotateMap(r: number): MapControl {
        this._map.rotateMap(r);
        return this;
    }

    public get navigation(): ITileNavigationState {
        return this._map.navigation;
    }

    // map related
    public get layerAddedObservable(): Observable<IImageTileMapLayer> {
        return this._map.layerAddedObservable;
    }

    public get layerRemovedObservable(): Observable<IImageTileMapLayer> {
        return this._map.layerRemovedObservable;
    }

    public getLayers(predicate?: (l: IImageTileMapLayer) => boolean, sorted?: boolean): IterableIterator<IImageTileMapLayer> {
        return this._map.getLayers(predicate, sorted);
    }

    public addLayer(layer: ImageLayer): void {
        this._map.addLayer(layer);
    }

    public removeLayer(layer: ImageLayer): void {
        this._map.removeLayer(layer);
    }

    // rendering related
    private _onMapValidation(valid: boolean, eventState: EventState): void {
        if (!valid) {
            this.markAsDirty();
        }
    }

    protected _additionalProcessing(parentMeasure: GUI.Measure, context: BABYLON.ICanvasRenderingContext): void {
        super._additionalProcessing(parentMeasure, context);
        if (this._cachedMeasure.width != this._currentMeasure.width || this._cachedMeasure.height != this._currentMeasure.height) {
            this._cachedMeasure.width = this._currentMeasure.width;
            this._cachedMeasure.height = this._currentMeasure.height;
            if (this._propertyChangedObservable && this._propertyChangedObservable.hasObservers()) {
                const e = new PropertyChangedEventArgs(this, undefined, this._cachedMeasure, "size");
                this._propertyChangedObservable.notifyObservers(e, -1, this, this);
            }
        }
    }

    protected _localDraw(context: BABYLON.ICanvasRenderingContext): void {
        this._map.validate();
        this._map.draw(context as ICanvasRenderingContext, this._currentMeasure.left, this._currentMeasure.top);
    }
}
