import { ISize2, ISize3 } from "./geometry.interfaces";

export class Size2 implements ISize2 {
    public static Zero() {
        return new Size2(0, 0);
    }

    public constructor(public width: number, public height: number) {}

    public clone(): ISize2 {
        return new Size2(this.width, this.height);
    }

    public equals(other: ISize2): boolean {
        return this.height === other.height && this.width === other.width;
    }
}
export class Size3 extends Size2 implements ISize3 {
    public static Zero() {
        return new Size3(0, 0, 0);
    }

    public constructor(width: number, height: number, public thickness: number) {
        super(width, height);
    }

    public get hasThickness(): boolean {
        return this.thickness !== undefined;
    }

    public clone(): ISize3 {
        return new Size3(this.width, this.height, this.thickness);
    }

    public equals(other: ISize3): boolean {
        return this.height === other.height && this.width === other.width && this.thickness === other.thickness;
    }
}
