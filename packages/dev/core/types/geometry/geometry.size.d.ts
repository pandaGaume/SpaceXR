import { ISize2, ISize3 } from "./geometry.interfaces";
export declare class Size2 implements ISize2 {
    height: number;
    width: number;
    static Zero(): Size2;
    constructor(height: number, width: number);
    clone(): ISize2;
    equals(other: ISize2): boolean;
}
export declare class Size3 extends Size2 implements ISize3 {
    thickness?: number | undefined;
    static Zero(): Size3;
    constructor(height: number, width: number, thickness?: number | undefined);
    get hasThickness(): boolean;
    clone(): ISize3;
    equals(other: ISize3): boolean;
}
