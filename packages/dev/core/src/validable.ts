import { Observable } from "./events";
import { IDisposable, IValidable } from "./types";

export class ValidableBase implements IValidable, IDisposable {
    _validationObservable?: Observable<boolean>;
    _valid: boolean = true;

    public get isValid(): boolean {
        return this._valid;
    }

    public get validationObservable(): Observable<boolean> {
        if (!this._validationObservable) {
            this._validationObservable = new Observable<boolean>();
        }
        return this._validationObservable;
    }

    public invalidate(): void {
        if (this.isValid) {
            this._doInvalidateInternal();
        }
    }

    public validate(force?: boolean): void {
        if (!this.isValid || force) {
            this._doValidateInternal();
        }
    }

    public revalidate(): void {
        this.invalidate();
        this.validate();
    }

    protected _doInvalidateInternal() {
        this._beforeInvalidate();
        this._valid = false;
        this._doInvalidate();
        if (this._validationObservable && this._validationObservable.hasObservers()) {
            this._validationObservable.notifyObservers(false, -1, this, this);
        }
        this._afterInvalidate();
    }

    protected _doValidateInternal() {
        this._beforeValidate();
        this._valid = true;
        this._doValidate();
        if (this._validationObservable && this._validationObservable.hasObservers()) {
            this._validationObservable.notifyObservers(true, -1, this, this);
        }
        this._afterValidate();
    }

    public dispose(): void {
        this._validationObservable?.clear();
    }

    protected _beforeInvalidate() {
        /* nothing to do here, may be override by subclass */
    }
    protected _doInvalidate() {
        /* nothing to do here, may be override by subclass */
    }
    protected _afterInvalidate() {
        /* nothing to do here, may be override by subclass */
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
