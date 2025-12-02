import { Bounds } from "../geometry.bounds";
import { Cartesian2, Cartesian3 } from "../geometry.cartesian";
import { IBounds, ICartesian3, RegionCode } from "../geometry.interfaces";
import { Point } from "./geometry.point";
import { AbstractShape } from "./geometry.shape";
import { ILine, IPoint, ShapeType } from "./geometry.shapes.interfaces";

export class Line extends AbstractShape implements ILine {

    public static Zero() : Line { return new Line(Cartesian3.Zero(), Cartesian3.Zero());}

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

    public clip(clipArea: IBounds): ILine | Array<ILine> | undefined {
        // Compute region codes for P1, P2
        let code1 = Cartesian2.ComputeCode(this._alice, clipArea);
        let code2 = Cartesian2.ComputeCode(this._bob, clipArea);

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
                code1 = Cartesian2.ComputeCode(a, clipArea);
            } else {
                b.x = x;
                b.y = y;
                code2 = Cartesian2.ComputeCode(b, clipArea);
            }
        } while (code1 != 0 || code2 != 0);

        return new Line(a, b);
    }

    /**
     * Robust 3D segment/segment intersection test.
     *
     * Handles:
     *  - Skew segments (no intersection)
     *  - Proper intersection at a single point
     *  - Parallel non-collinear segments (no intersection)
     *  - Collinear segments with overlapping part (returns overlapping segment or point)
     *
     * Note:
     *  - The math is done in full 3D, not just a 2D projection.
     *  - Epsilon is used for all "almost zero" tests.
     */
    public intersect(other: Line, epsilon = 1e-9): IPoint | ILine |undefined {
        
        const a0 = this._alice;
        const a1 = this._bob;
        const b0 = other._alice;
        const b1 = other._bob;

        // Direction vectors of the segments
        const u = Cartesian3.Subtract(a1, a0);
        const v = Cartesian3.Subtract(b1, b0);
        const w0 = Cartesian3.Subtract(a0, b0);

        const a = Cartesian3.Dot(u, u); // |u|^2
        const c = Cartesian3.Dot(v, v); // |v|^2

        // Handle degenerate segments (points)
        const aDegenerate = a < epsilon * epsilon;
        const cDegenerate = c < epsilon * epsilon;

        if (aDegenerate && cDegenerate) {
            // Both segments are actually single points
            if (Cartesian3.AreCoincident(a0, b0, epsilon)) {
                return new Point(a0.x, a0.y, a0.z);
            }
            return undefined
        }

        if (aDegenerate) {
            // A is a point, B is a true segment
            return other.containsPoint(a0, epsilon) ? new Point(a0.x, a0.y, a0.z) : undefined;
        } 
        
        if (cDegenerate) {
            // B is a point, A is a true segment
            return this.containsPoint(b0, epsilon) ? new Point(b0.x, b0.y, b0.z) : undefined;
        }

        const b = Cartesian3.Dot(u, v);
        const d = Cartesian3.Dot(u, w0);
        const e = Cartesian3.Dot(v, w0);

        const denom = a * c - b * b;
        
        // If denom is almost zero, the lines are parallel (maybe collinear)
        if (Math.abs(denom) < epsilon) {

            // Check if they are collinear:
            // w0 must be parallel to u (or v)
            const crossUW0 = Cartesian3.Cross(u, w0);
            const crossLen = Cartesian3.Magnitude(crossUW0);
            if (crossLen > epsilon * Math.sqrt(a) * 2) {
                // Parallel but not collinear
                return undefined;
            }

            // Collinear case:
            // Project B endpoints onto A to get scalar parameters and intersect the 1D intervals.
            const s0 = 0.0;
            const s1 = 1.0;

            const uLen2 = a; // |u|^2

            const sB0 = this._projectParamOnSegment(a0, u, uLen2, b0);
            const sB1 = this._projectParamOnSegment(a0, u, uLen2, b1);

            const sMinA = Math.min(s0, s1);
            const sMaxA = Math.max(s0, s1);

            const sMinB = Math.min(sB0, sB1);
            const sMaxB = Math.max(sB0, sB1);

            const sOverlapMin = Math.max(sMinA, sMinB);
            const sOverlapMax = Math.min(sMaxA, sMaxB);

            if (sOverlapMax < sOverlapMin - epsilon) {
                // No overlap
                return undefined;
            }

            // Overlap exists. It can be a single point or a segment.
            const clamp = (x: number) => Math.max(0, Math.min(1, x));
            const sStart = clamp(sOverlapMin);
            const sEnd   = clamp(sOverlapMax);

            const pStart = this._addScaled(a0, u, sStart);
            const pEnd   = this._addScaled(a0, u, sEnd);

            if (Cartesian3.Distance(pStart, pEnd) <= epsilon) {
                // The overlapping part is effectively a single point
                return new Point(pStart) ;
            } else {
                return new Line(pStart, pEnd );
            }
        }

        // Non-parallel case: compute closest points on the two infinite lines
        const s = (b * e - c * d) / denom;
        const t = (a * e - b * d) / denom;

        // If we want intersection of segments (not infinite lines), s and t must be in [0,1]
        if (s < -epsilon || s > 1 + epsilon || t < -epsilon || t > 1 + epsilon) {
            return undefined;
        }

        // Clamp to [0,1] to be robust to tiny numerical drift
        const sClamped = Math.max(0, Math.min(1, s));
        const tClamped = Math.max(0, Math.min(1, t));

        const pOnA = this._addScaled(a0, u, sClamped);
        const pOnB = this._addScaled(b0, v, tClamped);

        const dist = Cartesian3.Distance(pOnA, pOnB);

        if (dist > epsilon) {
            // The closest points are not the same -> skew segments
            return undefined;
        }

        // Unique intersection point (average of the two closest points)
        const mid = new Cartesian3(
            0.5 * (pOnA.x + pOnB.x),
            0.5 * (pOnA.y + pOnB.y),
            0.5 * (pOnA.z + pOnB.z)
        );
        return new Point(mid) ;
    }

    public containsPoint(p: ICartesian3, epsilon = 1e-9): boolean {
        // First, check if they are collinear
        if (!Cartesian3.AreCollinear(this._alice, this._bob, p, epsilon)) {
            return false;
        }
        // Then check if p lies between s0 and s1
        return Cartesian3.IsWithinTheBounds(this._alice, this._bob, p);
    }

    protected _buildBounds(): IBounds | undefined {
        return Bounds.FromPoints2(this._alice, this._bob);
    }
    protected _getPoints(): Array<ICartesian3> {
        return [this._alice, this._bob];
    }

    /**
     * Projects point p onto segment starting at a0 with direction u (not normalized),
     * and returns the scalar parameter s such that:
     *    proj(p) = a0 + s * u
     *
     * This is done in 3D, but the result is just one scalar.
     */
    private  _projectParamOnSegment(a0: ICartesian3, u: ICartesian3, uLen2: number, p: ICartesian3): number {
        const w = Cartesian3.Subtract(p, a0);
        if (uLen2 === 0) {
            return 0;
        }
        const s = Cartesian3.Dot(w, u) / uLen2;
        return s;
    }

    /**
     * Returns a0 + s * u as a new Cartesian3.
     */
    private _addScaled(a0: ICartesian3, u: ICartesian3, s: number): ICartesian3 {
        const out = Cartesian3.Zero();
        Cartesian3.MultiplyByFloatToRef(u, s, out);
        return Cartesian3.AddToRef(a0, out, out);
    }
}
