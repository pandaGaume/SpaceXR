import { ICloneable } from "../types";

// Defining region codes
export enum RegionCode {
    INSIDE = 0, // 0000
    LEFT = 1, // 0001
    RIGHT = 2, // 0010
    BOTTOM = 4, // 0100
    TOP = 8, // 1000
}

export interface ICartesian2 {
    x: number;
    y: number;
    toString(): string;
}

export interface ICartesian3 extends ICartesian2 {
    z: number;
}

export interface ICartesian4 extends ICartesian3 {
    w: number;
}

export type CartesianArray = Array<ICartesian2 | ICartesian3 | ICartesian4>;

export function isCartesian(b: unknown): b is ICartesian2 | ICartesian3 | ICartesian4 {
    if (typeof b !== "object" || b === null) return false;
    return (<ICartesian3>b).x !== undefined && (<ICartesian3>b).y !== undefined;
}

export function isCartesian3(b: unknown): b is ICartesian3 {
    if (typeof b !== "object" || b === null) return false;
    return (<ICartesian3>b).x !== undefined && (<ICartesian3>b).y !== undefined && (<ICartesian3>b).z !== undefined;
}

export function isCartesianArray(b: unknown): b is CartesianArray {
    return Array.isArray(b) && b.every(isCartesian);
}

export function isArrayOfCartesianArray(input: any): input is Array<CartesianArray> {
    if (!Array.isArray(input)) {
        return false;
    }
    return input.every(isCartesianArray);
}

export function isCartesian4(b: unknown): b is ICartesian4 {
    if (typeof b !== "object" || b === null) return false;
    return (<ICartesian4>b).x !== undefined && (<ICartesian4>b).y !== undefined && (<ICartesian4>b).z !== undefined && (<ICartesian4>b).w !== undefined;
}

export interface ISize2 {
    height: number;
    width: number;
}

export enum Side {
    left = 0,
    top = 1,
    right = 2,
    bottom = 3,
}

export interface ISize3 {
    height: number;
    width: number;
    thickness: number;
}

export function IsSize(b: unknown): b is ISize3 | ISize2 {
    if (typeof b !== "object" || b === null) return false;
    return (<ISize3>b).height !== undefined && (<ISize3>b).width !== undefined;
}

export function IsSize3(size: ISize2 | ISize3): size is ISize3 {
    return IsSize(size) && (size as ISize3).thickness !== undefined;
}

export interface IBounds2 extends ISize2, ICartesian2, ICloneable<IBounds2> {
    ymax: number;
    xmin: number;
    xmax: number;
    ymin: number;

    center: ICartesian2;

    intersects(other?: IBounds2): boolean;
    intersection(other?: IBounds2, ref?: IBounds2): IBounds2 | undefined;
    unionInPlace(other?: IBounds2): IBounds2;
    contains(x: number, y: number): boolean;
    containsBounds(other?: IBounds2): boolean;
    inflateInPlace(dx: number, dy: number): IBounds2;
    toString(): string;
    /// <summary>
    /// Return the 4 corners of the bounds in clockwise order starting from the bottom left corner.
    points(): IterableIterator<ICartesian2>;
}

export function IsBounds(b: unknown): b is IBounds2 {
    if (typeof b !== "object" || b === null) return false;
    return (<IBounds2>b).ymax !== undefined && (<IBounds2>b).xmin !== undefined && (<IBounds2>b).xmax !== undefined && (<IBounds2>b).ymin !== undefined;
}

export interface IBounded {
    bounds?: IBounds2;
}

export interface IPlane {
    point: ICartesian3;
    normal: ICartesian3;
}
