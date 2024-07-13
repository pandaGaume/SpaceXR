import { Unit } from "../math";
import { Bounds2 } from "./geometry.bounds";
import { ICartesian2, ICartesian3, ICartesian4, RegionCode } from "./geometry.interfaces";
export declare class Cartesian2 implements ICartesian2 {
    x: number;
    y: number;
    static Flatten(values: Array<ICartesian3>, ref?: Float32Array | Array<number>): Float32Array | Array<number>;
    static ComputeCode(point: ICartesian2, clipArea: Bounds2): RegionCode;
    static Dot(a: ICartesian2, b: ICartesian2): number;
    static Cross(a: ICartesian2, b: ICartesian2): ICartesian2;
    static Subtract(a: ICartesian2, b: ICartesian2): ICartesian2;
    static ConvertInPlace(value: ICartesian2, from: Unit, to: Unit): ICartesian2;
    static ConvertToRef(value: ICartesian2, from: Unit, to: Unit, ref?: ICartesian2): ICartesian2;
    static Zero(): Cartesian2;
    static One(): Cartesian2;
    constructor(x: number, y: number);
    toString(): string;
}
export declare class Cartesian3 extends Cartesian2 implements ICartesian3 {
    z: number;
    static Dot(a: ICartesian3, b: ICartesian3): number;
    static Cross(a: ICartesian3, b: ICartesian3): ICartesian3;
    static Subtract(a: ICartesian3, b: ICartesian3): ICartesian3;
    static Normalize(a: ICartesian3): ICartesian3;
    static NormalizeInPlace(a: ICartesian3): ICartesian3;
    static Normal(v0: ICartesian3, v1: ICartesian3, v2: ICartesian3): ICartesian3;
    static NormalizeToRef(a: ICartesian3, ref: ICartesian3): ICartesian3;
    static AreCoincident(a: ICartesian3, b: ICartesian3, epsilon?: number): boolean;
    static AreCollinear(a: ICartesian3, b: ICartesian3, c: ICartesian3, epsilon?: number): boolean;
    static IsWithinTheBounds(a: ICartesian3, b: ICartesian3, p: ICartesian3): boolean;
    static AreCoplanar(a: ICartesian3, b: ICartesian3, c: ICartesian3, d: ICartesian3, epsilon?: number): boolean;
    static MultplyByFloatInPlace(a: ICartesian3, n: number): ICartesian3;
    static MultplyByFloatToRef(a: ICartesian3, n: number, ref: ICartesian3): ICartesian3;
    static Magnitude(a: ICartesian3): number;
    static ConvertInPlace(value: ICartesian3 | ICartesian4, from: Unit, to: Unit): ICartesian3;
    static ConvertToRef(value: ICartesian3 | ICartesian4, from: Unit, to: Unit, ref?: ICartesian3): ICartesian3;
    static Centroid(values: Array<ICartesian3>, ref?: ICartesian3): ICartesian3;
    static Zero(): Cartesian3;
    static FromArray(array: Float32Array | Array<number>, offset?: number, stride?: number): ICartesian3;
    static Flatten(values: Array<ICartesian3>, ref?: Float32Array | Array<number>): Float32Array | Array<number>;
    static Equals(a: ICartesian3, b: ICartesian3, epsilon?: number): boolean;
    constructor(x: number, y: number, z?: number);
    toString(): string;
}
export declare class Cartesian4 extends Cartesian3 implements ICartesian4 {
    w: number;
    static Zero(): Cartesian4;
    constructor(x: number, y: number, z: number, w?: number);
    toString(): string;
}
