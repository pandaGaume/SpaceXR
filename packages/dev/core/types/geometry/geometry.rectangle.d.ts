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
    points(): IterableIterator<ICartesian2>;
    clone(): IRectangle;
    get ymax(): number;
    get xmin(): number;
    get xmax(): number;
    get ymin(): number;
    get center(): ICartesian2;
    intersect(other: IRectangle): boolean;
    intersection(other: IRectangle, ref?: IRectangle): IRectangle | undefined;
    unionInPlace(other: IRectangle): IRectangle;
    contains(x: number, y: number): boolean;
    toString(): string;
}
