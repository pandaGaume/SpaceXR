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

export function isCartesian3(b: unknown): b is ICartesian3 {
    if (typeof b !== "object" || b === null) return false;
    return (<ICartesian3>b).x !== undefined && (<ICartesian3>b).y !== undefined && (<ICartesian3>b).z !== undefined;
}

export interface ISize2 {
    height: number;
    width: number;
}

export function isSize2(b: unknown): b is ISize2 {
    if (typeof b !== "object" || b === null) return false;
    return (<ISize2>b).height !== undefined && (<ISize2>b).width !== undefined;
}

export interface ISize3 {
    height: number;
    width: number;
    thickness: number;
}

export function isSize3(b: unknown): b is ISize3 {
    if (typeof b !== "object" || b === null) return false;
    return (<ISize3>b).height !== undefined && (<ISize3>b).width !== undefined && (<ISize3>b).thickness !== undefined;
}

export interface IRectangle extends ISize2, ICartesian2, ICloneable<IRectangle> {
    top: number;
    left: number;
    right: number;
    bottom: number;

    center: ICartesian2;

    intersect(other: IRectangle): boolean;
    intersection(other: IRectangle, ref?: IRectangle): IRectangle | undefined;
    unionInPlace(other: IRectangle): IRectangle;
    contains(x: number, y: number): boolean;
    toString(): string;
}

export function isRectangle(b: unknown): b is IRectangle {
    if (typeof b !== "object" || b === null) return false;
    return (<IRectangle>b).top !== undefined && (<IRectangle>b).left !== undefined && (<IRectangle>b).right !== undefined && (<IRectangle>b).bottom !== undefined;
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

export function isBox(b: unknown): b is IBox {
    if (typeof b !== "object" || b === null) return false;
    return (
        (<IBox>b).top !== undefined &&
        (<IBox>b).left !== undefined &&
        (<IBox>b).right !== undefined &&
        (<IBox>b).bottom !== undefined &&
        (<IBox>b).floor !== undefined &&
        (<IBox>b).ceil !== undefined
    );
}
