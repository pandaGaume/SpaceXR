import { Observable, PropertyChangedEventArgs } from "../../events";
import { Size2, ISize2, ISize3, IsSize } from "../../geometry";
import { ITileDisplayBounds } from "../map";

export class TileDisplayBounds implements ITileDisplayBounds {
    _propertyChangedObservable?: Observable<PropertyChangedEventArgs<ITileDisplayBounds, unknown>>;
    _w: number;
    _h: number;

    public constructor(w?: number | ISize2, h?: number) {
        if (IsSize(w)) {
            h = w.height;
            w = w.width;
        }
        this._w = w ?? 0;
        this._h = h ?? 0;
    }

    public dispose(): void {}

    public get propertyChangedObservable(): Observable<PropertyChangedEventArgs<ITileDisplayBounds, unknown>> {
        if (!this._propertyChangedObservable) {
            this._propertyChangedObservable = new Observable<PropertyChangedEventArgs<ITileDisplayBounds, unknown>>();
        }
        return this._propertyChangedObservable;
    }
    public get displayWidth(): number {
        return this._w;
    }

    public get displayHeight(): number {
        return this._h;
    }

    public get ratio(): number {
        return this._w / this._h;
    }

    public resize(w: number | ISize2 | ISize3, h?: number): ITileDisplayBounds {
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
