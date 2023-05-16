import { ISize2, ISize3 } from "./geometry.interfaces";
export declare class Size2 implements ISize2 {
    width: number;
    height: number;
    static Zero(): Size2;
    constructor(width: number, height: number);
    clone(): ISize2;
    equals(other: ISize2): boolean;
}
export declare class Size3 extends Size2 implements ISize3 {
    thickness: number;
    static Zero(): Size3;
    constructor(width: number, height: number, thickness: number);
    get hasThickness(): boolean;
    clone(): ISize3;
    equals(other: ISize3): boolean;
}
