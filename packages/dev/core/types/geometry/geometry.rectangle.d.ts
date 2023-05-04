import { IRectangle, ICartesian2, ISize2 } from "./geometry.interfaces";
export declare class Rectangle implements IRectangle {
    x: number;
    y: number;
    width: number;
    height: number;
    static Zero(): Rectangle;
    static FromSize(size: ISize2): Rectangle;
    constructor(x: number, y: number, width: number, height: number);
    get top(): number;
    get left(): number;
    get right(): number;
    get bottom(): number;
    get center(): ICartesian2;
    intersect(other: IRectangle): boolean;
}
