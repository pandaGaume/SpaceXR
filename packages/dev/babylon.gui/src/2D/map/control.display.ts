import { ICanvasRenderingContext } from "@babylonjs/core";
import { Measure } from "@babylonjs/gui";
import { Control } from "@babylonjs/gui/2D/controls";
import { Observable, PropertyChangedEventArgs } from "core/events";
import { Cartesian2, Size2 } from "core/geometry";
import { ITileDisplay } from "core/tiles";

export class DisplayControl extends Control implements ITileDisplay {
    _propertyChangedObservable?: Observable<PropertyChangedEventArgs<ITileDisplay, unknown>>;
    _cachedMeasure: Measure;

    public constructor(name: string) {
        super(name);
        this._cachedMeasure = new Measure(0, 0, 0, 0);
    }

    public get x(): number {
        return this._currentMeasure.left ?? 0;
    }

    public get y(): number {
        return this._currentMeasure.top ?? 0;
    }

    public get width(): number {
        return this._currentMeasure.width ?? 0;
    }

    public get height(): number {
        return this._currentMeasure.height ?? 0;
    }

    public get propertyChangedObservable(): Observable<PropertyChangedEventArgs<ITileDisplay, unknown>> {
        if (!this._propertyChangedObservable) {
            this._propertyChangedObservable = new Observable<PropertyChangedEventArgs<ITileDisplay, unknown>>();
        }
        return this._propertyChangedObservable;
    }

    // override this method to provide additional processing and event notification
    // this is mandaory because the resize of the control may occur outside of the control api.
    protected _additionalProcessing(parentMeasure: Measure, context: ICanvasRenderingContext): void {
        if (this._cachedMeasure.left !== this._currentMeasure.left || this._cachedMeasure.top !== this._currentMeasure.top) {
            if (this._propertyChangedObservable?.hasObservers()) {
                const old = new Cartesian2(this._cachedMeasure.left, this._cachedMeasure.top);
                const value = new Cartesian2(this._currentMeasure.left, this._currentMeasure.top);
                const e = new PropertyChangedEventArgs(this, old, value, "position");
                this._propertyChangedObservable.notifyObservers(e);
            }
        }

        if (this._cachedMeasure.width !== this._currentMeasure.width || this._cachedMeasure.height !== this._currentMeasure.height) {
            if (this._propertyChangedObservable?.hasObservers()) {
                const old = new Size2(this._cachedMeasure.width, this._cachedMeasure.height);
                const value = new Size2(this._currentMeasure.width, this._currentMeasure.height);
                const e = new PropertyChangedEventArgs(this, old, value, "size");
                this._propertyChangedObservable.notifyObservers(e);
            }
        }

        this._cachedMeasure.copyFrom(this._currentMeasure);
    }

    resize(w: number, h: number): ITileDisplay {
        super.widthInPixels = w;
        super.heightInPixels = h;
        return this;
    }

    translate(x: number, y: number): ITileDisplay {
        super.leftInPixels = x;
        super.topInPixels = y;
        return this;
    }
}
