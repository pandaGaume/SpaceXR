import { Unit } from "../math";
import { ISize2, ISize3 } from "./geometry.interfaces";
export declare class Size2 implements ISize2 {
    width: number;
    height: number;
    static ConvertInPlace(size: ISize2, from: Unit, to: Unit): ISize2;
    static ConvertToRef(size: ISize2, from: Unit, to: Unit, ref?: ISize2): ISize2;
    static Zero(): Size2;
    constructor(width: number, height: number);
    multiplyFloats(w: number, h?: number): ISize2;
    clone(): ISize2;
    equals(other: ISize2): boolean;
}
export declare class Size3 extends Size2 implements ISize3 {
    depth: number;
    static ConvertInPlace(size: ISize3, from: Unit, to: Unit): ISize3;
    static ConvertToRef(size: ISize3, from: Unit, to: Unit, ref?: ISize3): ISize3;
    static Zero(): Size3;
    static IsEmpty(size: ISize3): boolean;
    static FromSize(size: ISize2 | ISize3): Size3;
    constructor(width: number, height: number, depth?: number);
    get hasThickness(): boolean;
    clone(): ISize3;
    equals(other: ISize3): boolean;
}
