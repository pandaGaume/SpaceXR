import { Cartesian2 } from "./geometry.cartesian";
import { IBounds2, ICartesian2, ISize2, IBounded, IsBounds } from "./geometry.interfaces";

export class Bounds2 implements IBounds2 {
    public static Zero(): IBounds2 {
        return new Bounds2(0, 0, 0, 0);
    }
    public static FromSize(size: ISize2): IBounds2 {
        return new Bounds2(0, 0, size?.width || 0, size.height || 0);
    }

    public static FromPoints(...params: Array<ICartesian2>): IBounds2 {
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
        return new Bounds2(xmin, ymin, xmax - xmin, ymax - ymin);
    }

    public static FromBounds(...array: Array<IBounds2 | IBounded | undefined>): IBounds2 | undefined {
        let rect: IBounds2 | undefined = undefined;
        for (let i = 0; i < array.length; i++) {
            let a = array[i];
            if (a) {
                if (IsBounds(a)) {
                    rect = rect ? rect.unionInPlace(a) : a.clone();
                } else {
                    a = a.bounds;
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

    public clone(): IBounds2 {
        return new Bounds2(this.x, this.y, this.width, this.height);
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
    public intersects(other?: IBounds2): boolean {
        if (!other || this.ymin > other.ymax || this.ymax < other.ymin || this.xmin > other.xmax || this.xmax < other.xmin) {
            return false;
        }
        return true;
    }
    public intersection(other?: IBounds2, ref?: IBounds2): IBounds2 | undefined {
        if (!other || !this.intersects(other)) {
            return undefined;
        }
        const target = ref || Bounds2.Zero();
        target.y = Math.max(this.ymin, other.ymin);
        target.height = Math.min(this.ymax, other.ymax) - target.y;
        target.x = Math.max(this.xmin, other.xmin);
        target.width = Math.min(this.xmax, other.xmax) - target.x;
        return target;
    }

    public unionInPlace(other?: IBounds2): IBounds2 {
        if (!other) return this;
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

export abstract class Bounded implements IBounded {
    _parent?: Bounded;
    _rect?: IBounds2;

    public constructor(bounds?: IBounds2, parent?: Bounded) {
        if (parent) {
            this._parent = parent;
        }
        this._rect = bounds;
    }

    public get parent(): Bounded | undefined {
        return this._parent;
    }

    public get bounds(): IBounds2 | undefined {
        this.validateBounds();
        return this._rect;
    }

    public validateBounds(): void {
        if (!this._rect) {
            this._rect = this._buildBounds();
        }
    }

    public invalidateBounds(): void {
        if (this._rect) {
            delete this._rect;
            if (this._parent) {
                this._parent.invalidateBounds();
            }
        }
    }

    protected abstract _buildBounds(): IBounds2 | undefined;
}
