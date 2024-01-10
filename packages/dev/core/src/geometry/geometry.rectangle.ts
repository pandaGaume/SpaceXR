import { Cartesian2 } from "./geometry.cartesian";
import { IRectangle, ICartesian2, ISize2, IBounded, IsRectangle } from "./geometry.interfaces";

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

    public static FromRectangles(...array: Array<IRectangle | IBounded | undefined>): IRectangle | undefined {
        let rect: IRectangle | undefined = undefined;
        for (let i = 0; i < array.length; i++) {
            let a = array[i];
            if (a) {
                if (IsRectangle(a)) {
                    rect = rect ? rect.unionInPlace(a) : a.clone();
                } else {
                    a = a.rect;
                    if (a) {
                        rect = rect ? rect.unionInPlace(a) : a.clone();
                    }
                }
            }
        }
        return rect;
    }

    public constructor(public x: number, public y: number, public width: number, public height: number) {}

    public *points(): IterableIterator<ICartesian2> {
        const r = this.xmax;
        const t = this.ymax;
        yield new Cartesian2(this.xmin, this.ymin);
        yield new Cartesian2(this.xmin, t);
        yield new Cartesian2(r, t);
        yield new Cartesian2(r, this.ymin);
    }

    public clone(): IRectangle {
        return new Rectangle(this.x, this.y, this.width, this.height);
    }

    public get ymax(): number {
        return this.y + this.height;
    }
    public get xmin(): number {
        return this.x;
    }
    public get xmax(): number {
        return this.x + this.width;
    }
    public get ymin(): number {
        return this.y;
    }
    public get center(): ICartesian2 {
        return new Cartesian2(this.x + this.width / 2, this.y + this.height / 2);
    }
    public intersect(other: IRectangle): boolean {
        if (!other || this.ymin > other.ymax || this.ymax < other.ymin || this.xmin > other.xmax || this.xmax < other.xmin) {
            return false;
        }
        return true;
    }
    public intersection(other: IRectangle, ref?: IRectangle): IRectangle | undefined {
        if (!this.intersect(other)) {
            return undefined;
        }
        const target = ref || Rectangle.Zero();
        target.y = Math.max(this.ymin, other.ymin);
        target.height = Math.min(this.ymax, other.ymax) - target.y;
        target.x = Math.max(this.xmin, other.xmin);
        target.width = Math.min(this.xmax, other.xmax) - target.x;
        return target;
    }

    public unionInPlace(other: IRectangle): IRectangle {
        const x1 = Math.min(this.x, other.x);
        const y1 = Math.min(this.y, other.y);
        const x2 = Math.max(this.xmax, other.xmax);
        const y2 = Math.max(this.ymax, other.ymax);

        this.x = x1;
        this.y = y1;
        this.width = x2 - x1;
        this.height = y2 - y1;
        return this;
    }

    public contains(x: number, y: number): boolean {
        return x >= this.xmin && x <= this.xmax && y >= this.ymax && y <= this.ymin;
    }

    public toString() {
        return `left:${this.xmin}, bottom:${this.ymin}, right:${this.xmax}, top:${this.ymax}, width:${this.width}, height:${this.height}`;
    }
}
