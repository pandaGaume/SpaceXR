import { ICartesian2, ICartesian3 } from "./geometry.interfaces";
export declare class Cartesian2 implements ICartesian2 {
    x: number;
    y: number;
    static Zero(): Cartesian2;
    constructor(x: number, y: number);
}
export declare class Cartesian3 implements ICartesian3 {
    x: number;
    y: number;
    z: number;
    static Zero(): Cartesian3;
    constructor(x: number, y: number, z: number);
}
