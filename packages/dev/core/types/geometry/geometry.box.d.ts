import { IBox, ICartesian3, ISize2, ISize3 } from "./geometry.interfaces";
export declare class Box implements IBox {
    x: number;
    y: number;
    z: number;
    width: number;
    height: number;
    thickness: number;
    static Zero(): IBox;
    static FromSize(size: ISize3): IBox;
    static FromPoints(...params: Array<ICartesian3>): IBox;
    constructor(x: number, y: number, z: number, width: number, height: number, thickness: number);
    get hasThickness(): boolean;
    get top(): number;
    get left(): number;
    get right(): number;
    get bottom(): number;
    get floor(): number;
    get ceil(): number;
    equals(other: IBox | ISize3 | ISize2 | undefined): boolean;
    get center(): ICartesian3;
    intersect(other: IBox): boolean;
    intersection(other: IBox, ref?: IBox): IBox | undefined;
    contains(x: number, y: number, z: number): boolean;
    toString(): string;
}
