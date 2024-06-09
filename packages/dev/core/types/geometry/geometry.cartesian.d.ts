import { Unit } from "../math";
import { ICartesian2, ICartesian3, ICartesian4 } from "./geometry.interfaces";
export declare class Cartesian2 implements ICartesian2 {
    x: number;
    y: number;
    static ConvertInPlace(value: ICartesian2, from: Unit, to: Unit): ICartesian2;
    static ConvertToRef(value: ICartesian2, from: Unit, to: Unit, ref?: ICartesian2): ICartesian2;
    static Zero(): Cartesian2;
    static One(): Cartesian2;
    constructor(x: number, y: number);
    toString(): string;
}
export declare class Cartesian3 implements ICartesian3 {
    x: number;
    y: number;
    z: number;
    static ConvertInPlace(value: ICartesian3 | ICartesian4, from: Unit, to: Unit): ICartesian3;
    static ConvertToRef(value: ICartesian3 | ICartesian4, from: Unit, to: Unit, ref?: ICartesian3): ICartesian3;
    static Zero(): Cartesian3;
    constructor(x: number, y: number, z: number);
    toString(): string;
}
export declare class Cartesian4 implements ICartesian4 {
    x: number;
    y: number;
    z: number;
    w: number;
    static Zero(): Cartesian4;
    constructor(x: number, y: number, z: number, w?: number);
    toString(): string;
}
