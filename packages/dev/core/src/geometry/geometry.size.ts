import { Quantity, Unit } from "../math";
import { ISize2, ISize3, IsSize3 } from "./geometry.interfaces";

export class Size2 implements ISize2 {
    public static ConvertInPlace(size: ISize2, from: Unit, to: Unit): ISize2 {
        return Size2.ConvertToRef(size, from, to, size);
    }

    public static ConvertToRef(size: ISize2, from: Unit, to: Unit, ref?: ISize2): ISize2 {
        ref = ref ?? Size2.Zero();
        ref.width = Quantity.Convert(size.width, from, to);
        ref.height = Quantity.Convert(size.height, from, to);

        return ref;
    }

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
    public static ConvertInPlace(size: ISize3, from: Unit, to: Unit): ISize3 {
        return Size3.ConvertToRef(size, from, to, size);
    }

    public static ConvertToRef(size: ISize3, from: Unit, to: Unit, ref?: ISize3): ISize3 {
        ref = ref ?? Size3.Zero();
        ref.width = Quantity.Convert(size.width, from, to);
        ref.height = Quantity.Convert(size.height, from, to);
        ref.depth = Quantity.Convert(size.depth, from, to);
        return ref;
    }

    public static Zero() {
        return new Size3(0, 0, 0);
    }

    public static IsEmpty(size: ISize3): boolean {
        return size.width === 0 && size.height === 0 && (size.depth ?? 0) === 0;
    }

    public static FromSize(size: ISize2 | ISize3): Size3 {
        if (IsSize3(size)) {
            return new Size3(size.width, size.height, size.depth);
        }
        return new Size3(size.width, size.height);
    }

    public constructor(width: number, height: number, public depth: number = 0) {
        super(width, height);
    }

    public get hasThickness(): boolean {
        return this.depth !== undefined;
    }

    public clone(): ISize3 {
        return new Size3(this.width, this.height, this.depth);
    }

    public equals(other: ISize3): boolean {
        return this.height === other.height && this.width === other.width && this.depth === other.depth;
    }
}
