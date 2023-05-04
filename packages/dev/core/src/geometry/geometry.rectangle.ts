import { Cartesian2 } from "./geometry.cartesian";
import { IRectangle, ICartesian2, ISize2 } from "./geometry.interfaces";

export class Rectangle implements IRectangle {
    public static Zero() {
        return new Rectangle(0, 0, 0, 0);
    }
    public static FromSize(size: ISize2) {
        return new Rectangle(0, 0, size?.width || 0, size.height || 0);
    }

    public constructor(public x: number, public y: number, public width: number, public height: number) {}

    public get top(): number {
        return this.y;
    }
    public get left(): number {
        return this.x;
    }
    public get right(): number {
        return this.x + this.width;
    }
    public get bottom(): number {
        return this.y + this.height;
    }
    public get center(): ICartesian2 {
        return new Cartesian2(this.x + this.width / 2, this.y + this.height / 2);
    }
    public intersect(other: IRectangle): boolean {
        if (!other || this.bottom < other.top || this.top > other.bottom || this.left > other.right || this.right < other.left) {
            return false;
        }
        return true;
    }
}
