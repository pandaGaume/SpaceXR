import { ISize2, ISize3, IsSize3 } from "./geometry.interfaces";

export class Size2 implements ISize2 {
    public static Zero() {
        return new Size2(0, 0);
    }

    public constructor(public width: number, public height: number) {}

    public multiplyFloats(w: number, h?: number): ISize2 {
        return new Size2(this.width * w, this.height * (h ?? w));
    }

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

    public static FromSize(size: ISize2 | ISize3): Size3 {
        if (IsSize3(size)) {
            return new Size3(size.width, size.height, size.thickness);
        }
        return new Size3(size.width, size.height);
    }

    public constructor(width: number, height: number, public thickness: number = 0) {
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
