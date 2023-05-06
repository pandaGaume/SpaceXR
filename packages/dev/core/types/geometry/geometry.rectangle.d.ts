import { IRectangle, ICartesian2, ISize2 } from "./geometry.interfaces";
export declare class Rectangle implements IRectangle {
    x: number;
    y: number;
    width: number;
    height: number;
    static Zero(): IRectangle;
    static FromSize(size: ISize2): IRectangle;
    static FromPoints(...params: Array<ICartesian2>): IRectangle;
    constructor(x: number, y: number, width: number, height: number);
    get top(): number;
    get left(): number;
    get right(): number;
    get bottom(): number;
    get center(): ICartesian2;
    intersect(other: IRectangle): boolean;
    intersection(other: IRectangle, ref?: IRectangle): IRectangle | undefined;
    contains(x: number, y: number): boolean;
    toString(): string;
}
