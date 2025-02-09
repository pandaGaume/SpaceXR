import { Bounds } from "../geometry.bounds";
import { Cartesian2, Cartesian3 } from "../geometry.cartesian";
import { IBounds, ICartesian3, isCartesian } from "../geometry.interfaces";
import { AbstractShape } from "./geometry.shape";
import { IPoint, ShapeType } from "./geometry.shapes.interfaces";

export class Point extends AbstractShape implements IPoint {
    _position: ICartesian3;

    public constructor(a: ICartesian3 | number, b?: number, c?: number) {
        super(ShapeType.Point);
        if (isCartesian(a)) {
            this._position = a;
        } else {
            this._position = new Cartesian3(a, b ?? 0, c ?? 0);
        }
    }

    public get position(): ICartesian3 {
        return this._position;
    }

    public set position(v: ICartesian3) {
        if (Cartesian3.Equals(v, this._position) == false) {
            this._position = v;
            this.invalidateBounds();
        }
    }

    public clip(clipArea: IBounds): IPoint | Array<IPoint> | undefined {
        let code = Cartesian2.ComputeCode(this._position, clipArea);
        if (code == 0) {
            return this;
        }
        return undefined;
    }

    protected _buildBounds(): IBounds | undefined {
        return Bounds.FromPoints2(this._position);
    }

    protected _getPoints(): Array<ICartesian3> {
        return [this._position];
    }
}
