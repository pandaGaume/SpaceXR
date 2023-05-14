import { Cartesian2 } from "./geometry.cartesian";
import { IRectangle, ICartesian2, ISize2, isRectangle } from "./geometry.interfaces";

export class Rectangle implements IRectangle {
    public static Zero(): IRectangle {
        return new Rectangle(0, 0, 0, 0);
    }
    public static FromSize(size: ISize2): IRectangle {
        return new Rectangle(0, 0, size?.width || 0, size.height || 0);
    }

    public static FromPoints(...params: Array<ICartesian2>): IRectangle {
        let i = 0;
        let xmin = params[i].x;
        let xmax = params[i].x;
        let ymin = params[i].y;
        let ymax = params[i++].y;
        for (; i < params.length; i++) {
            const p = params[i];
            if (p) {
                xmin = Math.min(xmin, p.x);
                xmax = Math.max(xmax, p.x);
                ymin = Math.min(ymin, p.y);
                ymax = Math.max(ymax, p.y);
            }
        }
        return new Rectangle(xmin, ymin, xmax - xmin, ymax - ymin);
    }

    public constructor(public x: number, public y: number, public width: number, public height: number) {}

    public clone(): IRectangle {
        return new Rectangle(this.x, this.y, this.width, this.height);
    }

    public equals(other: IRectangle | ISize2 | undefined): boolean {
        if (other) {
            if (isRectangle(other)) {
                return this.x == other.x && this.y == other.y && this.width == other.width && this.height == other.height;
            }
            return this.width == other.width && this.height == other.height;
        }
        return false;
    }

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
    public intersection(other: IRectangle, ref?: IRectangle): IRectangle | undefined {
        if (!this.intersect(other)) {
            return undefined;
        }
        const target = ref || Rectangle.Zero();
        target.y = Math.max(this.top, other.top);
        target.height = Math.min(this.bottom, other.bottom) - target.y;
        target.x = Math.max(this.left, other.left);
        target.width = Math.min(this.right, other.right) - target.x;
        return target;
    }

    public unionInPlace(other: IRectangle): IRectangle {
        const x1 = Math.min(this.x, other.x);
        const y1 = Math.min(this.y, other.y);
        const x2 = Math.max(this.right, other.right);
        const y2 = Math.max(this.bottom, other.bottom);

        this.x = x1;
        this.y = y1;
        this.width = x2 - x1;
        this.height = y2 - y1;
        return this;
    }

    public contains(x: number, y: number): boolean {
        return x >= this.left && x <= this.right && y >= this.top && y <= this.bottom;
    }

    public toString() {
        return `left:${this.left}, top:${this.top}, width:${this.width}, height:${this.height}`;
    }
}
