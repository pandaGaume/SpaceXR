import { ICanvasRenderingContext } from "@babylonjs/core";
import { Measure } from "@babylonjs/gui";
import { Control } from "@babylonjs/gui/2D/controls";
import { Observable, PropertyChangedEventArgs } from "core/events";
import { ITileDisplay } from "core/tiles";
export declare class DisplayControl extends Control implements ITileDisplay {
    _propertyChangedObservable?: Observable<PropertyChangedEventArgs<ITileDisplay, unknown>>;
    _cachedMeasure: Measure;
    constructor(name: string);
    get x(): number;
    get y(): number;
    get width(): number;
    get height(): number;
    get propertyChangedObservable(): Observable<PropertyChangedEventArgs<ITileDisplay, unknown>>;
    protected _additionalProcessing(parentMeasure: Measure, context: ICanvasRenderingContext): void;
    resize(w: number, h: number): ITileDisplay;
    translate(x: number, y: number): ITileDisplay;
}
