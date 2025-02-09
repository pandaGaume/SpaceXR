import { Observable, PropertyChangedEventArgs } from "../../events";
import { ISize2, ISize3, Size3 } from "../../geometry";
import { IDisplay } from "../map";

export class Display implements IDisplay {
    private _propertyChangedObservable?: Observable<PropertyChangedEventArgs<IDisplay, unknown>>;

    public get propertyChangedObservable(): Observable<PropertyChangedEventArgs<IDisplay, unknown>> {
        if (!this._propertyChangedObservable) {
            this._propertyChangedObservable = new Observable<PropertyChangedEventArgs<IDisplay, unknown>>();
        }
        return this._propertyChangedObservable;
    }

    private _resolution: ISize3;

    public constructor(resolution: ISize2 | ISize3) {
        // make a copy
        this._resolution = Size3.FromSize(resolution);
    }

    public get resolution(): ISize3 {
        return this._resolution;
    }

    public resize(width: number, height: number, thickness?: number) {
        if (this._resolution.width != width || this._resolution.height != height || this._resolution.depth != thickness) {
            if (this._propertyChangedObservable && this._propertyChangedObservable.hasObservers()) {
                const old = this._resolution;
                this._resolution = new Size3(width, height, thickness ?? this._resolution.depth);
                this._propertyChangedObservable.notifyObservers(new PropertyChangedEventArgs(this, old, this._resolution, "resolution"));
                return;
            }
            this._resolution.width = width;
            this._resolution.height = height;
            if (thickness) {
                this._resolution.depth = thickness;
            }
        }
    }

    public dispose(): void {
        this._propertyChangedObservable?.clear();
    }
}
