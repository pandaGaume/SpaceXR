import { ISize2, ISize3 } from "./geometry.interfaces";

export class Size2 implements ISize2 {
    public static Zero() {
        return new Size2(0, 0);
    }

    public constructor(public height: number, public width: number) {}

    public clone(): ISize2 {
        return new Size2(this.height, this.width);
    }

    public equals(other: ISize2): boolean {
        return this.height === other.height && this.width === other.width;
    }
}
export class Size3 extends Size2 implements ISize3 {
    public static Zero() {
        return new Size3(0, 0, 0);
    }

    public constructor(height: number, width: number, public thickness?: number) {
        super(height, width);
    }

    public get hasThickness(): boolean {
        return this.thickness !== undefined;
    }

    public clone(): ISize3 {
        return new Size3(this.height, this.width, this.thickness);
    }

    public equals(other: ISize3): boolean {
        return this.height === other.height && this.width === other.width && this.thickness === other.thickness;
    }
}
