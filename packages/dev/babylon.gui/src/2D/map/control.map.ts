import * as BABYLON from "@babylonjs/core";
import * as GUI from "@babylonjs/gui";
import { EventState, Observable, Observer, PropertyChangedEventArgs } from "core/events";
import { IGeo2 } from "core/geography";
import { Size2 } from "core/geometry";
import { Context2DTileMap, ICanvasRenderingContext, ICanvasRenderingOptions } from "core/map";
import { ITileDisplay, ITileMap, ITileMapLayer, ITileMetrics, ITileNavigationApi, ITileNavigationState } from "core/tiles";
import { Nullable } from "core/types";

export type ControlTileContentType = HTMLImageElement;

export class MapControl extends GUI.Container implements ITileDisplay, ICanvasRenderingOptions, ITileNavigationApi<MapControl>, ITileMap<ControlTileContentType> {
    _propertyChangedObservable?: Observable<PropertyChangedEventArgs<ITileDisplay, unknown>>;

    _map: Context2DTileMap;
    _mapValidationObserver: Nullable<Observer<boolean>>;

    public constructor(name: string, nav?: ITileNavigationState) {
        super(name);
        this._map = new Context2DTileMap(name, this, this, nav);
        this._mapValidationObserver = this._map.validationObservable.add(this.onMapValidation.bind(this));
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

    public dispose(): void {
        this._mapValidationObserver?.disconnect();
        this._map.dispose();
        super.dispose();
    }

    // navigation related
    public setView(center: IGeo2 | Array<number>, zoom?: number, rotation?: number): MapControl {
        this._map.setView(center, zoom, rotation);
        return this;
    }

    public zooming(delta: number): MapControl {
        this._map.zooming(delta);
        return this;
    }

    zoomIn(delta: number): MapControl {
        this._map.zoomIn(delta);
        return this;
    }
    zoomOut(delta: number): MapControl {
        this._map.zoomOut(delta);
        return this;
    }
    translatePixel(tx: number, ty: number, metrics?: ITileMetrics): MapControl {
        this._map.translatePixel(tx, ty, metrics);
        return this;
    }
    translate(lat: IGeo2 | Array<number> | number, lon?: number): MapControl {
        this._map.translate(lat, lon);
        return this;
    }
    rotate(r: number): MapControl {
        this._map.rotate(r);
        return this;
    }

    public get navigation(): ITileNavigationState {
        return this._map.navigation;
    }

    // map related
    public get layerAddedObservable(): Observable<ITileMapLayer<ControlTileContentType>> {
        return this._map.layerAddedObservable;
    }

    public get layerRemovedObservable(): Observable<ITileMapLayer<ControlTileContentType>> {
        return this._map.layerRemovedObservable;
    }

    public getLayers(predicate?: (l: ITileMapLayer<ControlTileContentType>) => boolean, sorted?: boolean): IterableIterator<ITileMapLayer<ControlTileContentType>> {
        return this._map.getLayers(predicate, sorted);
    }

    public addLayer(layer: ITileMapLayer<ControlTileContentType>): void {
        this._map.addLayer(layer);
    }

    public removeLayer(layer: ITileMapLayer<ControlTileContentType>): void {
        this._map.removeLayer(layer);
    }

    // rendering related
    private onMapValidation(valid: boolean, eventState: EventState): void {
        if (!valid) {
            this.markAsDirty();
        }
    }

    protected _additionalProcessing(parentMeasure: GUI.Measure, context: BABYLON.ICanvasRenderingContext): void {
        super._additionalProcessing(parentMeasure, context);
        if (this._propertyChangedObservable && this._propertyChangedObservable.hasObservers()) {
            const value = new Size2(this._currentMeasure.width, this._currentMeasure.height);
            const e = new PropertyChangedEventArgs(this, undefined, value, "size");
            this._propertyChangedObservable.notifyObservers(e, -1,this,this);
        }
    }

    protected _localDraw(context: BABYLON.ICanvasRenderingContext): void {
        this._map.validate();
        this._map.draw(context as ICanvasRenderingContext);
    }
}
