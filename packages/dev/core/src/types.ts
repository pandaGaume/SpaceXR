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
