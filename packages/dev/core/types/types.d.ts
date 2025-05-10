import { Observable } from "./events";
export type Nullable<T> = T | null;
export type FloatArray = number[] | Float32Array;
export type IndicesArray = number[] | Int32Array | Uint32Array | Uint16Array;
export declare function isFloatArray(input: any): input is FloatArray;
export declare function isArrayOfFloatArray(input: any): input is FloatArray[];
export interface ICloneable<T> {
    clone(): T;
}
export interface IComparable<T> {
    equals(other: T | undefined): boolean;
}
export declare function IsDisposable(obj: unknown): obj is IDisposable;
export interface IDisposable {
    dispose(): void;
}
export declare function isValidable(obj: unknown): obj is IValidable;
export interface IValidable {
    validationObservable?: Observable<boolean>;
    isValid: boolean;
    invalidate(): void;
    validate(force?: boolean): void;
    revalidate(): void;
}
export declare function IsNumber(value: unknown): value is number;
export declare function IsString(value: unknown): value is string;
export declare function HasToString(value: unknown): value is {
    toString(): string;
};
