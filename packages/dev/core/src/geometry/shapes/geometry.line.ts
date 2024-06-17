import { Bounds2 } from "../geometry.bounds";
import { Cartesian3 } from "../geometry.cartesian";
import { IBounds2, ICartesian3 } from "../geometry.interfaces";
import { AbstractShape } from "./geometry.shape";
import { ILine, ShapeType } from "./geometry.shapes.interfaces";

export class Line extends AbstractShape implements ILine {
    _alice: ICartesian3;
    _bob: ICartesian3;

    public constructor(a: ICartesian3, b: ICartesian3) {
        super(ShapeType.Line);
        this._alice = a;
        this._bob = b;
    }

    public get start(): ICartesian3 {
        return this._alice;
    }

    public set start(v: ICartesian3) {
        if (Cartesian3.Equals(v, this._alice) == false) {
            this._alice = v;
            this.invalidateBounds();
        }
    }

    public get end(): ICartesian3 {
        return this._bob;
    }

    public set end(v: ICartesian3) {
        if (Cartesian3.Equals(v, this._bob) == false) {
            this._bob = v;
            this.invalidateBounds();
        }
    }

    protected _buildBounds(): IBounds2 | undefined {
        return Bounds2.FromPoints(this._alice, this._bob);
    }
}
