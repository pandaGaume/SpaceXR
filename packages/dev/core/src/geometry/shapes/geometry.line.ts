import { Bounds2 } from "../geometry.bounds";
import { Cartesian3 } from "../geometry.cartesian";
import { IBounds2, ICartesian3, RegionCode } from "../geometry.interfaces";
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

    public clip(clipArea: IBounds2): ILine | Array<ILine> | undefined {
        // Compute region codes for P1, P2
        let code1 = this._alice.computeCode(clipArea);
        let code2 = this._alice.computeCode(clipArea);

        if (code1 == 0 && code2 == 0) {
            // If both endpoints lie within rectangle
            return this;
        }
        if (code1 & code2) {
            // If both endpoints are outside rectangle,
            // in same region
            return undefined;
        }

        let a = new Cartesian3(this._alice.x, this._alice.y, this._alice.z);
        let b = new Cartesian3(this._bob.x, this._bob.y, this._bob.z);

        do {
            // Some segment of line lies within the
            // rectangle
            let code_out = code1 != 0 ? code1 : code2;
            let x = 0,
                y = 0;

            const x1 = a.x;
            const y1 = a.y;
            const x2 = b.x;
            const y2 = b.y;

            // Find intersection point;
            // using formulas y = y1 + slope * (x - x1),
            // x = x1 + (1 / slope) * (y - y1)
            if (code_out & RegionCode.TOP) {
                const y_max = clipArea.ymax;
                // point is above the clip rectangle
                x = x1 + ((x2 - x1) * (y_max - y1)) / (y2 - y1);
                y = y_max;
            } else if (code_out & RegionCode.BOTTOM) {
                // point is below the rectangle
                const y_min = clipArea.ymin;
                x = x1 + ((x2 - x1) * (y_min - y1)) / (y2 - y1);
                y = y_min;
            } else if (code_out & RegionCode.RIGHT) {
                // point is to the right of rectangle
                const x_max = clipArea.xmax;
                y = y1 + ((y2 - y1) * (x_max - x1)) / (x2 - x1);
                x = x_max;
            } else if (code_out & RegionCode.LEFT) {
                // point is to the left of rectangle
                const x_min = clipArea.xmin;
                y = y1 + ((y2 - y1) * (x_min - x1)) / (x2 - x1);
                x = x_min;
            }

            // Now intersection point x, y is found
            // We replace point outside rectangle
            // by intersection point
            if (code_out == code1) {
                a.x = x;
                a.y = y;
                code1 = this._alice.computeCode(clipArea);
            } else {
                b.x = x;
                b.y = y;
                code1 = this._bob.computeCode(clipArea);
            }
        } while (code1 != 0 && code2 != 0);

        return new Line(a, b);
    }

    protected _buildBounds(): IBounds2 | undefined {
        return Bounds2.FromPoints(this._alice, this._bob);
    }
}
