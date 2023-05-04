import { IComparable } from "../types";

export interface ICartesian2 {
    x: number;
    y: number;
}

export interface ICartesian3 {
    x: number;
    y: number;
    z: number;
}

export interface ISize2 extends IComparable<ISize2> {
    height: number;
    width: number;
}

export interface ISize3 extends IComparable<ISize3> {
    height: number;
    width: number;
    thickness?: number;

    hasThickness: boolean;
}

export interface IRectangle {
    x: number;
    y: number;
    height: number;
    width: number;

    top: number;
    left: number;
    right: number;
    bottom: number;

    center: ICartesian2;

    intersect(other: IRectangle): boolean;
}
