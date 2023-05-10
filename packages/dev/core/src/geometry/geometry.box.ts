import { Cartesian3 } from "./geometry.cartesian";
import { IBox, ICartesian3, ISize2, ISize3, isBox, isSize3 } from "./geometry.interfaces";

export class Box implements IBox {
    public static Zero(): IBox {
        return new Box(0, 0, 0, 0, 0, 0);
    }
    public static FromSize(size: ISize3): IBox {
        return new Box(0, 0, 0, size?.width || 0, size.height || 0, size.thickness || 0);
    }

    public static FromPoints(...params: Array<ICartesian3>): IBox {
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
        return new Box(xmin, ymin, zmin, xmax - xmin, ymax - ymin, zmax - zmin);
    }

    public constructor(public x: number, public y: number, public z: number, public width: number, public height: number, public thickness: number) {}

    public get hasThickness(): boolean {
        return true;
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

    public get floor(): number {
        return this.z;
    }
    public get ceil(): number {
        return this.z + this.thickness;
    }

    public equals(other: IBox | ISize3 | ISize2 | undefined): boolean {
        if (other) {
            if (isBox(other)) {
                return this.x == other.x && this.y == other.y && this.z == other.z && this.width == other.width && this.height == other.height && this.thickness == other.thickness;
            }
            if (isSize3(other)) {
                return this.width == other.width && this.height == other.height && this.thickness == other.thickness;
            }
            return this.width == other.width && this.height == other.height;
        }
        return false;
    }

    public get center(): ICartesian3 {
        return new Cartesian3(this.x + this.width / 2, this.y + this.height / 2, this.z + this.thickness / 2);
    }

    public intersect(other: IBox): boolean {
        if (
            !other ||
            this.bottom < other.top ||
            this.top > other.bottom ||
            this.left > other.right ||
            this.right < other.left ||
            this.floor > other.ceil ||
            this.ceil < other.floor
        ) {
            return false;
        }
        return true;
    }
    public intersection(other: IBox, ref?: IBox): IBox | undefined {
        if (!this.intersect(other)) {
            return undefined;
        }
        const target = ref || Box.Zero();
        target.y = Math.max(this.top, other.top);
        target.height = Math.min(this.bottom, other.bottom) - target.y;
        target.x = Math.max(this.left, other.left);
        target.width = Math.min(this.right, other.right) - target.x;
        target.z = Math.max(this.floor, other.floor);
        target.width = Math.min(this.ceil, other.ceil) - target.z;
        return target;
    }

    public contains(x: number, y: number, z: number): boolean {
        return x >= this.left && x <= this.right && y >= this.top && y <= this.bottom && z >= this.floor && z <= this.ceil;
    }
    public toString() {
        return `x:${this.x}, y:${this.y}, z:${this.z}, width:${this.width}, height:${this.height}, thickness:${this.thickness}`;
    }
}
