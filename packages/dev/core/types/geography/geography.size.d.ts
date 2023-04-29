import { ISize2, ISize3 } from "./geography.interfaces";
export declare class Size2 implements ISize2 {
    static Zero(): Size2;
    protected _height: number;
    protected _width: number;
    constructor(height: number, width: number);
    get height(): number;
    get width(): number;
    clone(): ISize2;
    equals(other: ISize2): boolean;
}
export declare class Size3 extends Size2 implements ISize3 {
    static Zero(): Size3;
    protected _thickness?: number;
    constructor(height: number, width: number, thickness?: number);
    get thickness(): number | undefined;
    get hasThickness(): boolean;
    clone(): ISize3;
    equals(other: ISize3): boolean;
}
