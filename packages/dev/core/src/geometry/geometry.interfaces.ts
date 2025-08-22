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

export interface IQuaternion extends ICartesian4 {}

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

/**
 * Describes a 3D bounding sphere (as in Babylon.js BoundingSphere).
 */
export interface IBoundingSphere {
    /**
     * The center point of the sphere.
     */
    center: ICartesian3;

    /**
     * The radius of the sphere.
     */
    radius: number;
}

export interface IBoundingBox {
    /**
     * The minimum point (corner) of the bounding box.
     */
    minimum: ICartesian3;

    /**
     * The maximum point (corner) of the bounding box.
     */
    maximum: ICartesian3;

    /**
     * The center point of the bounding box.
     */
    center: ICartesian3;

    /**
     * The extend size (half-dimensions) from center to box side.
     */
    extendSize: ICartesian3;
}

export interface IBounds extends IBoundingBox, ISize3, ICartesian3, ICloneable<IBounds> {
    ymax: number;
    xmax: number;
    zmax: number;
    xmin: number;
    ymin: number;
    zmin: number;

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

export function IsBounded(b: unknown): b is IBounded {
    if (typeof b !== "object" || b === null) return false;
    return (<IBounded>b).boundingBox !== undefined || (<IBounded>b).boundingSphere !== undefined;
}

export interface IPlane {
    d: number;
    normal: ICartesian3;
}

export function MakePlaneFromPointAndNormal(point: ICartesian3, normal: ICartesian3, hull: Array<ICartesian3>): IPlane {
    // Normalize the normal
    const len = Math.hypot(normal.x, normal.y, normal.z);
    const n = len === 0 ? { x: 0, y: 0, z: 0 } : { x: normal.x / len, y: normal.y / len, z: normal.z / len };

    // Compute scalar d
    const d = -(n.x * point.x + n.y * point.y + n.z * point.z);

    return { d: d, normal: n };
}
