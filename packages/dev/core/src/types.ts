import { Observable } from "./events";

/** Alias type for value that can be null */
export type Nullable<T> = T | null;
/** Alias type for number array or Float32Array */
export type FloatArray = number[] | Float32Array;
/** Alias type for number array or Float32Array or Int32Array or Uint32Array or Uint16Array */
export type IndicesArray = number[] | Int32Array | Uint32Array | Uint16Array;

export function isFloatArray(input: any): input is FloatArray {
    if (Array.isArray(input)) {
        // Check if the input is a number array
        return input.every((item: any) => typeof item === "number");
    }
    // Check if the input is a Float32Array
    return input instanceof Float32Array;
}

export function isArrayOfFloatArray(input: any): input is FloatArray[] {
    if (!Array.isArray(input)) {
        return false;
    }
    return input.every(isFloatArray);
}

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

export function isValidable(obj: unknown): obj is IValidable {
    if (typeof obj !== "object" || obj === null) return false;
    return (<IValidable>obj).validate !== undefined && (<IValidable>obj).invalidate !== undefined;
}

export interface IValidable {
    validationObservable?: Observable<boolean>;
    isValid: boolean;
    invalidate(): void;
    validate(force?: boolean): void;
    revalidate(): void;
}

export function IsNumber(value: unknown): value is number {
    return typeof value === "number" && !Number.isNaN(value);
}

export function IsString(value: unknown): value is string {
    return typeof value === "string";
}

export function HasToString(value: unknown): value is { toString(): string } {
    return value !== null && typeof value === "object" && typeof (value as { toString: unknown }).toString === "function";
}
