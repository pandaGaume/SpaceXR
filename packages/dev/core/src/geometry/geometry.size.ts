import { ISize2, ISize3 } from "./geometry.interfaces";

export class Size2 implements ISize2 {
    public static Zero() {
        return new Size2(0, 0);
    }

    protected _height: number;
    protected _width: number;

    public constructor(height: number, width: number) {
        this._height = height;
        this._width = width;
    }

    public get height(): number {
        return this._height;
    }

    public get width(): number {
        return this._width;
    }

    public clone(): ISize2 {
        return new Size2(this._height, this._width);
    }

    public equals(other: ISize2): boolean {
        return this._height === other.height && this._width === other.width;
    }
}
export class Size3 extends Size2 implements ISize3 {
    public static Zero() {
        return new Size3(0, 0, 0);
    }

    protected _thickness?: number;

    public constructor(height: number, width: number, thickness?: number) {
        super(height, width);
        this._thickness = thickness;
    }

    public get thickness(): number | undefined {
        return this._thickness;
    }

    public get hasThickness(): boolean {
        return this._thickness !== undefined;
    }

    public clone(): ISize3 {
        return new Size3(this._height, this._width, this._thickness);
    }

    public equals(other: ISize3): boolean {
        return this._height === other.height && this._width === other.width && this._thickness === other.thickness;
    }
}
