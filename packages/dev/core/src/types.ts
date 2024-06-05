import { Observable } from "./events";

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

export function IsDisposable(obj: unknown): obj is IDisposable {
    if (typeof obj !== "object" || obj === null) return false;
    return (<IDisposable>obj).dispose !== undefined;
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
