import { Quantity, Unit } from "../math";
import { ICartesian2, ICartesian3 } from "./geometry.interfaces";

export class Cartesian2 implements ICartesian2 {
    public static ConvertInPlace(value: ICartesian2, from: Unit, to: Unit): ICartesian2 {
        return Cartesian2.ConvertToRef(value, from, to, value);
    }

    public static ConvertToRef(value: ICartesian2, from: Unit, to: Unit, ref?: ICartesian2): ICartesian2 {
        ref = ref ?? Cartesian2.Zero();
        ref.x = Quantity.Convert(value.x, from, to);
        ref.y = Quantity.Convert(value.y, from, to);
        return ref;
    }

    public static Zero() {
        return new Cartesian2(0, 0);
    }
    public static One() {
        return new Cartesian2(1, 1);
    }

    public constructor(public x: number, public y: number) {}

    public toString() {
        return `x:${this.x}, y:${this.y}`;
    }
}
export class Cartesian3 implements ICartesian3 {
    public static ConvertInPlace(value: ICartesian3, from: Unit, to: Unit): ICartesian3 {
        return Cartesian3.ConvertToRef(value, from, to, value);
    }

    public static ConvertToRef(value: ICartesian3, from: Unit, to: Unit, ref?: ICartesian3): ICartesian3 {
        ref = ref ?? Cartesian3.Zero();
        ref.x = Quantity.Convert(value.x, from, to);
        ref.y = Quantity.Convert(value.y, from, to);
        ref.z = Quantity.Convert(value.z, from, to);
        return ref;
    }

    public static Zero() {
        return new Cartesian3(0, 0, 0);
    }
    public constructor(public x: number, public y: number, public z: number) {}
    public toString() {
        return `x:${this.x}, y:${this.y}, z:${this.z}`;
    }
}
