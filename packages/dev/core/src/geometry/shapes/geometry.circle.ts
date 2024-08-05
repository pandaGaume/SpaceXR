import { Bounds2 } from "../geometry.bounds";
import { Cartesian3 } from "../geometry.cartesian";
import { IBounds2, ICartesian3 } from "../geometry.interfaces";
import { AbstractShape } from "./geometry.shape";
import { ICircle, ShapeType } from "./geometry.shapes.interfaces";

export class Circle extends AbstractShape implements ICircle {
    _center: ICartesian3;
    _radius: number;

    public constructor(c: ICartesian3, radius: number) {
        super(ShapeType.Circle);
        this._center = c;
        this._radius = radius;
    }

    public get center(): ICartesian3 {
        return this._center;
    }

    public set center(v: ICartesian3) {
        if (Cartesian3.Equals(v, this._center) == false) {
            this._center = v;
            this.invalidateBounds();
        }
    }

    public get radius(): number {
        return this._radius;
    }

    public set radius(v: number) {
        if (this._radius !== v) {
            this._radius = v;
            this.invalidateBounds();
        }
    }

    protected _buildBounds(): IBounds2 | undefined {
        const r = this._radius;
        const x = this._center.x;
        const y = this._center.y;

        return new Bounds2(x - r, y - r, r * 2, r * 2);
    }

    protected _getPoints(): Array<ICartesian3> {
        return [this._center];
    }
}
