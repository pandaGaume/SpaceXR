import { Observable } from "../../events/events.observable";
import { PropertyChangedEventArgs } from "../../events/events.args";
import { ISize2 } from "../../geometry/geometry.interfaces";
import { Size2 } from "../../geometry/geometry.size";
import { IValidable } from "../../types";
import { ITileDisplay } from "./tiles.interfaces.pipeline";

export class TileDisplay implements ITileDisplay, IValidable<TileDisplay> {
    _resizeObservable?: Observable<PropertyChangedEventArgs<ITileDisplay, ISize2>>;
    _w: number;
    _h: number;
    _valid: boolean;

    public constructor(w?: number, h?: number) {
        this._w = w ?? 0;
        this._h = h ?? 0;
        this._valid = false;
    }

    public dispose(): void {}

    public get isValid(): boolean {
        return this._valid;
    }

    public invalidate(): TileDisplay {
        this._valid = false;
        return this;
    }

    public validate(): TileDisplay {
        if (!this._valid) {
            this._doValidateInternal();
            this._valid = true;
        }
        return this;
    }

    public revalidate(): TileDisplay {
        return this.invalidate().validate();
    }

    public get resizeObservable(): Observable<PropertyChangedEventArgs<ITileDisplay, ISize2>> {
        this._resizeObservable = this._resizeObservable || new Observable<PropertyChangedEventArgs<ITileDisplay, ISize2>>();
        return this._resizeObservable;
    }

    public get width(): number {
        return this._w;
    }

    public get height(): number {
        return this._h;
    }

    public setSize(w: number, h: number): ITileDisplay {
        if (this._w !== w || this._h != h) {
            if (this._resizeObservable && this._resizeObservable.hasObservers()) {
                const old = new Size2(this._w, this._h);
                const value = new Size2(w, h);
                this._w = w;
                this._h = h;
                const e = new PropertyChangedEventArgs(this, old, value);
                this._resizeObservable.notifyObservers(e);
                this.invalidate();
                return this;
            }
            this._w = w;
            this._h = h;
            this.invalidate();
        }
        return this;
    }

    protected _doValidateInternal() {
        this._beforeValidate();
        this._doValidate();
        this._afterValidate();
    }

    protected _beforeValidate() {
        /* nothing to do here, may be override by subclass */
    }
    protected _doValidate() {
        /* nothing to do here, may be override by subclass */
    }
    protected _afterValidate() {
        /* nothing to do here, may be override by subclass */
    }
}
