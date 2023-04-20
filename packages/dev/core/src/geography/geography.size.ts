import { ISize } from "./geography.interfaces";

export class Size implements ISize {
    private _height: number;
    private _width: number;
    private _thickness?: number;

    public constructor(height: number, width: number, thickness?: number) {
        this._height = height;
        this._width = width;
        this._thickness = thickness;
    }

    public get height(): number {
        return this._height;
    }

    public get width(): number {
        return this._width;
    }

    public get thickness(): number | undefined {
        return this._thickness;
    }

    public get hasThickness(): boolean {
        return this._thickness !== undefined;
    }

    public clone(): ISize {
        return new Size(this._height, this._width, this._thickness);
    }

    public equals(other: ISize): boolean {
        return this._height === other.height && this._width === other.width && this._thickness === other.thickness;
    }
}
