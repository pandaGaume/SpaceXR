import { Observable, PropertyChangedEventArgs } from "../../events";
import { Size2, ISize2, ISize3, IsSize } from "../../geometry";
import { DisplayUnit, ITileDisplay } from "../map";

export class TileDisplay implements ITileDisplay {
    _propertyChangedObservable?: Observable<PropertyChangedEventArgs<ITileDisplay, unknown>>;
    _w: number;
    _h: number;
    _unit: DisplayUnit;

    public constructor(w?: number, h?: number, u?: DisplayUnit) {
        this._w = w ?? 0;
        this._h = h ?? 0;
        this._unit = u ?? DisplayUnit.Pixels;
    }

    public dispose(): void {}

    public get propertyChangedObservable(): Observable<PropertyChangedEventArgs<ITileDisplay, unknown>> {
        if (!this._propertyChangedObservable) {
            this._propertyChangedObservable = new Observable<PropertyChangedEventArgs<ITileDisplay, unknown>>();
        }
        return this._propertyChangedObservable;
    }
    public get displayWidth(): number {
        return this._w;
    }

    public get displayHeight(): number {
        return this._h;
    }

    public get displayUnit(): DisplayUnit {
        return this._unit;
    }

    public resize(w: number | ISize2 | ISize3, h?: number): ITileDisplay {
        if (IsSize(w)) {
            h = w.height;
            w = w.width;
        }
        h = h ?? 0;
        if (this._w !== w || this._h != h) {
            if (this._propertyChangedObservable && this._propertyChangedObservable.hasObservers()) {
                const old = new Size2(this._w, this._h);
                const value = new Size2(w, h);
                this._w = w;
                this._h = h;
                const e = new PropertyChangedEventArgs(this, old, value, "size");
                this._propertyChangedObservable.notifyObservers(e, -1, this, this);
                return this;
            }
            this._w = w;
            this._h = h;
        }
        return this;
    }
}
