import { ICloneable } from "../types";
export interface ICartesian2 {
    x: number;
    y: number;
    toString(): string;
}
export interface ICartesian3 {
    x: number;
    y: number;
    z: number;
    toString(): string;
}
export interface ICartesian4 {
    x: number;
    y: number;
    z: number;
    w: number;
    toString(): string;
}
export declare function isCartesian(b: unknown): b is ICartesian2 | ICartesian3 | ICartesian4;
export declare function isCartesian3(b: unknown): b is ICartesian3;
export declare function isCartesian4(b: unknown): b is ICartesian4;
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
    thickness: number;
}
export declare function IsSize(b: unknown): b is ISize3 | ISize2;
export declare function IsSize3(size: ISize2 | ISize3): size is ISize3;
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
    toString(): string;
    points(): IterableIterator<ICartesian2>;
}
export declare function IsBounds(b: unknown): b is IBounds2;
export interface IBounded {
    bounds?: IBounds2;
}
export interface IPlane {
    point: ICartesian3;
    normal: ICartesian3;
}
