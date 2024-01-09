import { Observable } from "../../events/events.observable";
import { PropertyChangedEventArgs } from "../../events/events.args";

import { Size2 } from "../../geometry/geometry.size";
import { ITileDisplay } from "../tiles.interfaces";

export class TileDisplay implements ITileDisplay {
    _propertyChangedObservable?: Observable<PropertyChangedEventArgs<ITileDisplay, unknown>>;
    _w: number;
    _h: number;

    public constructor(w?: number, h?: number) {
        this._w = w ?? 0;
        this._h = h ?? 0;
    }

    public dispose(): void {}

    public get propertyChangedObservable(): Observable<PropertyChangedEventArgs<ITileDisplay, unknown>> {
        if (!this._propertyChangedObservable) {
            this._propertyChangedObservable = new Observable<PropertyChangedEventArgs<ITileDisplay, unknown>>();
        }
        return this._propertyChangedObservable;
    }
    public get width(): number {
        return this._w;
    }

    public get height(): number {
        return this._h;
    }

    public resize(w: number, h: number): ITileDisplay {
        if (this._w !== w || this._h != h) {
            if (this._propertyChangedObservable && this._propertyChangedObservable.hasObservers()) {
                const old = new Size2(this._w, this._h);
                const value = new Size2(w, h);
                this._w = w;
                this._h = h;
                const e = new PropertyChangedEventArgs(this, old, value, "size");
                this._propertyChangedObservable.notifyObservers(e);
                return this;
            }
            this._w = w;
            this._h = h;
        }
        return this;
    }
}
