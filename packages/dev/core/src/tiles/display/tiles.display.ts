import { Observable, PropertyChangedEventArgs } from "../../events";
import { Size2, ISize2, ISize3, IsSize } from "../../geometry";
import { ITileDisplayBounds } from "../map";

export class TileDisplayBounds extends Size2 implements ITileDisplayBounds {
    _propertyChangedObservable?: Observable<PropertyChangedEventArgs<ITileDisplayBounds, unknown>>;

    public constructor(w?: number | ISize2, h?: number) {
        if (IsSize(w)) {
            h = w.height;
            w = w.width;
            super(w, h);
        } else {
            super(w ?? 0, h ?? 0);
        }
    }

    public dispose(): void {}

    public get propertyChangedObservable(): Observable<PropertyChangedEventArgs<ITileDisplayBounds, unknown>> {
        if (!this._propertyChangedObservable) {
            this._propertyChangedObservable = new Observable<PropertyChangedEventArgs<ITileDisplayBounds, unknown>>();
        }
        return this._propertyChangedObservable;
    }

    public get ratio(): number {
        return this.width / this.height;
    }

    public resize(w: number | ISize2 | ISize3, h?: number): ITileDisplayBounds {
        if (IsSize(w)) {
            h = w.height;
            w = w.width;
        }
        h = h ?? 0;
        if (this.width !== w || this.height != h) {
            if (this._propertyChangedObservable && this._propertyChangedObservable.hasObservers()) {
                const old = new Size2(this.width, this.height);
                const value = new Size2(w, h);
                this.width = w;
                this.height = h;
                const e = new PropertyChangedEventArgs(this, old, value, "size");
                this._propertyChangedObservable.notifyObservers(e, -1, this, this);
                return this;
            }
            this.width = w;
            this.height = h;
        }
        return this;
    }
}
