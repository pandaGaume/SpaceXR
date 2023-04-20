import { ISize } from "./geography.interfaces";
export declare class Size implements ISize {
    private _height;
    private _width;
    private _thickness?;
    constructor(height: number, width: number, thickness?: number);
    get height(): number;
    get width(): number;
    get thickness(): number | undefined;
    get hasThickness(): boolean;
    clone(): ISize;
    equals(other: ISize): boolean;
}
