import { Observable } from "./events";
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
export interface IValidable {
    validationObservable?: Observable<boolean>;
    isValid: boolean;
    invalidate(): void;
    validate(force?: boolean): void;
    revalidate(): void;
}
