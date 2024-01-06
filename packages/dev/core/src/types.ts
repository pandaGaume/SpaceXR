/** Alias type for value that can be null */
export type Nullable<T> = T | null;
/** Alias type for number array or Float32Array */
export type FloatArray = number[] | Float32Array;
/** Alias type for number array or Float32Array or Int32Array or Uint32Array or Uint16Array */
export type IndicesArray = number[] | Int32Array | Uint32Array | Uint16Array;

export interface ICloneable<T> {
    clone(): T;
}

export interface IComparable<T> {
    equals(other: T | undefined): boolean;
}

export interface IDisposable {
    dispose(): void;
}

export interface IValidable<T> {
    isValid: boolean;
    invalidate(): T;
    validate(force?: boolean): T;
    revalidate(): T;
}

export class ValidableBase implements IValidable<unknown> {
    _valid: boolean = false;

    public get isValid(): boolean {
        return this._valid;
    }
    public invalidate(): ValidableBase {
        if (this._valid) {
            this._doInvalidateInternal();
        }
        return this;
    }

    public validate(force?: boolean): ValidableBase {
        if (!this._valid || force) {
            this._doValidateInternal();
        }
        return this;
    }

    public revalidate(): ValidableBase {
        return this.invalidate().validate();
    }

    protected _doInvalidateInternal() {
        this._beforeInvalidate();
        this._valid = false;
        this._doInvalidate();
        this._afterInvalidate();
    }

    protected _doValidateInternal() {
        this._beforeValidate();
        this._valid = true;
        this._doValidate();
        this._afterValidate();
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
