import { ICloneable } from "../types";
export declare enum RegionCode {
    INSIDE = 0,
    LEFT = 1,
    RIGHT = 2,
    BOTTOM = 4,
    TOP = 8
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
export declare function isCartesian(b: unknown): b is ICartesian2 | ICartesian3 | ICartesian4;
export declare function isCartesian3(b: unknown): b is ICartesian3;
export declare function isCartesianArray(b: unknown): b is CartesianArray;
export declare function isArrayOfCartesianArray(input: any): input is Array<CartesianArray>;
export declare function isCartesian4(b: unknown): b is ICartesian4;
export interface IQuaternion extends ICartesian4 {
}
export interface ISize2 {
    height: number;
    width: number;
}
export declare enum Side {
    left = 0,
    top = 1,
    right = 2,
    bottom = 3
}
export interface ISize3 {
    height: number;
    width: number;
    depth: number;
}
export declare function IsSize(b: unknown): b is ISize3 | ISize2;
export declare function IsSize3(size: ISize2 | ISize3): size is ISize3;
export interface IBoundingSphere {
    center: ICartesian3;
    radius: number;
}
export interface IBoundingBox {
    minimum: ICartesian3;
    maximum: ICartesian3;
    center: ICartesian3;
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
    points(): IterableIterator<ICartesian3>;
}
export declare function IsBounds(b: unknown): b is IBounds;
export interface IBounded {
    boundingBox?: IBounds;
    boundingSphere?: IBoundingSphere;
}
export declare function IsBounded(b: unknown): b is IBounded;
export interface IPlane {
    d: number;
    normal: ICartesian3;
}
export declare function MakePlaneFromPointAndNormal(point: ICartesian3, normal: ICartesian3, hull: Array<ICartesian3>): IPlane;
