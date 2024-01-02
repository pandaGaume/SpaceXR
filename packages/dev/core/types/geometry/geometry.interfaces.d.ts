import { ICloneable } from "..";
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
export declare function isCartesian3(b: unknown): b is ICartesian3;
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
export declare function isSize2(b: unknown): b is ISize2;
export interface ISize3 {
    height: number;
    width: number;
    thickness: number;
}
export declare function isSize3(b: unknown): b is ISize3;
export interface IRectangle extends ISize2, ICartesian2, ICloneable<IRectangle> {
    ymax: number;
    xmin: number;
    xmax: number;
    ymin: number;
    center: ICartesian2;
    intersect(other: IRectangle): boolean;
    intersection(other: IRectangle, ref?: IRectangle): IRectangle | undefined;
    unionInPlace(other: IRectangle): IRectangle;
    contains(x: number, y: number): boolean;
    toString(): string;
    points(): IterableIterator<ICartesian2>;
}
export declare function isRectangle(b: unknown): b is IRectangle;
export interface IBounded {
    rect?: IRectangle;
}
export interface IBox extends ISize3, ICartesian3 {
    top: number;
    left: number;
    right: number;
    bottom: number;
    floor: number;
    ceil: number;
    center: ICartesian3;
    intersect(other: IBox): boolean;
    intersection(other: IBox, ref?: IBox): IBox | undefined;
    contains(x: number, y: number, z: number): boolean;
    toString(): string;
}
export declare function isBox(b: unknown): b is IBox;
