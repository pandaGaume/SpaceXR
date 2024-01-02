export type Nullable<T> = T | null;
export type FloatArray = number[] | Float32Array;
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
    validate(): T;
    revalidate(): T;
}
export declare class ValidableBase implements IValidable<ValidableBase> {
    _valid: boolean;
    get isValid(): boolean;
    invalidate(): ValidableBase;
    validate(force?: boolean): ValidableBase;
    revalidate(): ValidableBase;
    protected _doValidateInternal(): void;
    protected _beforeValidate(): void;
    protected _doValidate(): void;
    protected _afterValidate(): void;
}
