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
