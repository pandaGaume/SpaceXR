import { ICartesian2, ICartesian3 } from "./geometry.interfaces";

export class Cartesian2 implements ICartesian2 {
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
    public static Zero() {
        return new Cartesian3(0, 0, 0);
    }
    public constructor(public x: number, public y: number, public z: number) {}
    public toString() {
        return `x:${this.x}, y:${this.y}, z:${this.z}`;
    }
}
