import { Cartesian3 } from "./geometry.cartesian";
import { IBounds, ICartesian3, ISize3, IBounded, ICartesian2, IsBounds } from "./geometry.interfaces";

export class Bounds extends Cartesian3 implements IBounds {
    public static Zero(): Bounds {
        return new Bounds(0, 0, 0, 0, 0, 0);
    }

    public static FromSize(size: ISize3): Bounds {
        return new Bounds(0, 0, size?.width || 0, size?.height || 0, 0, size?.depth || 0);
    }

    public static FromBounds(...array: Array<IBounds | IBounded | undefined>): IBounds | undefined {
        let rect: IBounds | undefined = undefined;
        for (let i = 0; i < array.length; i++) {
            let a = array[i];
            if (a) {
                if (IsBounds(a)) {
                    rect = rect ? rect.unionInPlace(a) : a.clone();
                } else {
                    a = a.boundingBox;
                    if (a) {
                        rect = rect ? rect.unionInPlace(a) : a.clone();
                    }
                }
            }
        }
        return rect;
    }

    public static FromPoints2(...params: Array<ICartesian2>): Bounds {
        let i = 0;
        let xmin = params[i].x;
        let xmax = params[i].x;
        let ymin = params[i].y;
        let ymax = params[i].y;
        for (; i < params.length; i++) {
            const p = params[i];
            if (p) {
                xmin = Math.min(xmin, p.x);
                xmax = Math.max(xmax, p.x);
                ymin = Math.min(ymin, p.y);
                ymax = Math.max(ymax, p.y);
            }
        }
        return new Bounds(xmin, ymin, xmax - xmin, ymax - ymin);
    }

    public static FromPoints3(...params: Array<ICartesian3>): Bounds {
        let i = 0;
        let xmin = params[i].x;
        let xmax = params[i].x;
        let ymin = params[i].y;
        let ymax = params[i].y;
        let zmin = params[i].z;
        let zmax = params[i++].z;
        for (; i < params.length; i++) {
            const p = params[i];
            if (p) {
                xmin = Math.min(xmin, p.x);
                xmax = Math.max(xmax, p.x);
                ymin = Math.min(ymin, p.y);
                ymax = Math.max(ymax, p.y);
                zmin = Math.min(zmin, p.z);
                zmax = Math.max(zmax, p.z);
            }
        }
        return new Bounds(xmin, ymin, xmax - xmin, ymax - ymin, zmin, zmax - zmin);
    }

    public constructor(x: number, y: number, public width: number, public height: number, z: number = 0, public depth: number = 0) {
        super(x, y, z);
    }

    public *points(): IterableIterator<ICartesian3> {
        const r = this.xmax;
        const t = this.ymax;
        const f = this.zmax;
        yield new Cartesian3(this.xmin, this.ymin, this.zmin);
        yield new Cartesian3(this.xmin, this.ymin, f);
        yield new Cartesian3(this.xmin, t, this.zmin);
        yield new Cartesian3(this.xmin, t, f);
        yield new Cartesian3(r, this.ymin, this.zmin);
        yield new Cartesian3(r, this.ymin, f);
        yield new Cartesian3(r, t, this.zmin);
        yield new Cartesian3(r, t, f);
    }

    public clone(): IBounds {
        return new Bounds(this.x, this.y, this.width, this.height, this.z, this.depth);
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
    public get ymax(): number {
        return this.y + this.height;
    }
    public get zmin(): number {
        return this.z;
    }
    public get zmax(): number {
        return this.z + this.depth;
    }
    public get center(): ICartesian3 {
        return new Cartesian3(this.x + this.width / 2, this.y + this.height / 2, this.z + this.depth / 2);
    }
    public get minimum(): ICartesian3 {
        return this;
    }
    public get maximum(): ICartesian3 {
        return new Cartesian3(this.x + this.width, this.y + this.height, this.z + this.depth);
    }
    public get extendSize(): ICartesian3 {
        return new Cartesian3(this.width, this.height, this.depth);
    }

    public intersects(other?: IBounds): boolean {
        if (!other || this.xmin > other.xmax || this.xmax < other.xmin || this.ymin > other.ymax || this.ymax < other.ymin || this.zmin > other.zmax || this.zmax < other.zmin) {
            return false;
        }
        return true;
    }

    public intersection(other?: IBounds, ref?: IBounds): IBounds | undefined {
        if (!other || !this.intersects(other)) {
            return undefined;
        }
        const target = ref || Bounds.Zero();
        target.x = Math.max(this.xmin, other.xmin);
        target.width = Math.min(this.xmax, other.xmax) - target.x;
        target.y = Math.max(this.ymin, other.ymin);
        target.height = Math.min(this.ymax, other.ymax) - target.y;
        target.z = Math.max(this.zmin, other.zmin);
        target.depth = Math.min(this.zmax, other.zmax) - target.z;
        return target;
    }

    public containsFloat(x: number, y: number, z: number = 0): boolean {
        return x >= this.xmin && x <= this.xmax && y >= this.ymin && y <= this.ymax && z >= this.zmin && z <= this.zmax;
    }

    public containsBounds(other?: IBounds): boolean {
        if (!other) return false;
        return other.xmin >= this.xmin && other.xmax <= this.xmax && other.ymin >= this.ymin && other.ymax <= this.ymax && other.zmin >= this.zmin && other.zmax <= this.zmax;
    }
    public unionInPlace(other?: IBounds): IBounds {
        if (!other) return this;
        const x1 = Math.min(this.x, other.x);
        const y1 = Math.min(this.y, other.y);
        const z1 = Math.min(this.z, other.z);
        const x2 = Math.max(this.xmax, other.xmax);
        const y2 = Math.max(this.ymax, other.ymax);
        const z2 = Math.max(this.zmax, other.zmax);

        this.x = x1;
        this.y = y1;
        this.z = z1;
        this.width = x2 - x1;
        this.height = y2 - y1;
        this.depth = z2 - z1;
        return this;
    }

    public inflateInPlace(dx: number, dy: number, dz: number = 0): IBounds {
        this.x -= dx;
        this.y -= dy;
        this.z -= dz;
        this.width += 2 * dx;
        this.height += 2 * dy;
        this.depth += 2 * dz;
        return this;
    }

    public toString() {
        return `left:${this.xmin}, bottom:${this.ymin}, front:${this.zmin}, right:${this.xmax}, top:${this.ymax}, back:${this.zmax}, width:${this.width}, height:${this.height}, depth:${this.depth}`;
    }
}

export abstract class Bounded implements IBounded {
    _parent?: Bounded;
    _rect?: IBounds;

    public constructor(bounds?: IBounds, parent?: Bounded) {
        if (parent) {
            this._parent = parent;
        }
        this._rect = bounds;
    }

    public get parent(): Bounded | undefined {
        return this._parent;
    }

    public get boundingBox(): IBounds | undefined {
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

    protected abstract _buildBounds(): IBounds | undefined;
}
