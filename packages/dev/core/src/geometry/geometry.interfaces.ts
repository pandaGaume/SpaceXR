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
    depth: number;
}

export function IsSize(b: unknown): b is ISize3 | ISize2 {
    if (typeof b !== "object" || b === null) return false;
    return (<ISize3>b).height !== undefined && (<ISize3>b).width !== undefined;
}

export function IsSize3(size: ISize2 | ISize3): size is ISize3 {
    return IsSize(size) && (size as ISize3).depth !== undefined;
}

export interface IBoundingSphere {
    center: ICartesian3;
    radius: number;
}

export interface IBounds extends ISize3, ICartesian3, ICloneable<IBounds> {
    ymax: number;
    xmax: number;
    zmax: number;
    xmin: number;
    ymin: number;
    zmin: number;

    center: ICartesian3;

    intersects(other?: IBounds): boolean;
    intersection(other?: IBounds, ref?: IBounds): IBounds | undefined;
    unionInPlace(other?: IBounds): IBounds;
    containsBounds(other?: IBounds): boolean;
    containsFloat(x: number, y: number, z?: number): boolean;
    inflateInPlace(dx: number, dy: number, dz?: number): IBounds;
    toString(): string;
    /// <summary>
    /// Return the 4 corners of the bounds in clockwise order starting from the bottom left corner.
    points(): IterableIterator<ICartesian3>;
}

export function IsBounds(b: unknown): b is IBounds {
    if (typeof b !== "object" || b === null) return false;
    return (
        (<IBounds>b).xmin !== undefined &&
        (<IBounds>b).ymin !== undefined &&
        (<IBounds>b).zmin !== undefined &&
        (<IBounds>b).xmax !== undefined &&
        (<IBounds>b).ymax !== undefined &&
        (<IBounds>b).zmax !== undefined
    );
}

export interface IBounded {
    boundingBox?: IBounds;
    boundingSphere?: IBoundingSphere;
}

export interface IPlane {
    point: ICartesian3;
    normal: ICartesian3;
}
