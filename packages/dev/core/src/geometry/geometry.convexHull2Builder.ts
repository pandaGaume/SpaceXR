import { Nullable } from "../types";

export class ConvexHull2Builder {
    _positions: Float32Array;
    _stride: number;
    _n: number;

    public constructor(positions: Float32Array, stride: number = 2) {
        if (stride < 2) throw new Error("stride must be greater or equal to 2 - ie X and Y coordinates at least");
        this._positions = positions;
        this._stride = stride;
        this._n = this._positions.length / this._stride;
    }

    public withPositions(positions: Float32Array, stride: number = 2): ConvexHull2Builder {
        if (stride < 2) throw new Error("stride must be greater than 1");
        this._positions = positions;
        this._stride = stride;
        this._n = this._positions.length / this._stride;
        return this;
    }

    public build(): Nullable<Array<number>> {
        if (this._n < 3) {
            return null;
        }

        // re-init the hull
        const hull: Array<number> = [];

        // Finding the point with minimum and
        // maximum x-coordinate
        let min_x = 0,
            max_x = 0;
        for (let i = 1; i < this._n; i++) {
            if (this._positions[i] < this._positions[min_x]) min_x = i;
            if (this._positions[i] > this._positions[max_x]) max_x = i;
        }

        // Recursively find convex hull points on
        // one side of line joining a[min_x] and
        // a[max_x]
        this._quickHullToRef(min_x, max_x, 1, hull);

        // Recursively find convex hull points on
        // other side of line joining a[min_x] and
        // a[max_x]
        this._quickHullToRef(min_x, max_x, -1, hull);

        return hull;
    }

    // Returns the side of point p with respect to line
    // joining points p1 and p2.
    private _findSide(p1: number, p2: number, p: number): number {
        let val = this._lineDist(p1, p2, p);
        return val > 0 ? 1 : val < 0 ? -1 : 0;
    }

    // returns a value proportional to the distance
    // between the point p and the line joining the
    // points p1 and p2
    private _lineDist(p1: number, p2: number, p: number): number {
        return (
            (this._positions[p + 1] - this._positions[p1 + 1]) * (this._positions[p2] - this._positions[p1]) -
            (this._positions[p2 + 1] - this._positions[p1 + 1]) * (this._positions[p] - this._positions[p1])
        );
    }

    // End points of line L are p1 and p2. side can have value
    // 1 or -1 specifying each of the parts made by the line L
    private _quickHullToRef(p1: number, p2: number, side: number, hull: Array<number>): void {
        let ind = -1;
        let max_dist = 0;

        // finding the point with maximum distance
        // from L and also on the specified side of L.
        for (let i = 0; i < this._positions.length; i += this._stride) {
            let temp = Math.abs(this._lineDist(p1, p2, this._positions[i]));
            if (this._findSide(p1, p2, this._positions[i]) == side && temp > max_dist) {
                ind = i;
                max_dist = temp;
            }
        }

        // If no point is found, add the end points
        // of L to the convex hull.
        if (ind == -1) {
            hull.push(this._positions[p1], this._positions[p1 + 1], this._positions[p2], this._positions[p2 + 1]);
            return;
        }

        // Recur for the two parts divided by a[ind]
        this._quickHullToRef(ind, p1, -this._findSide(ind, p1, p2), hull);
        this._quickHullToRef(ind, p2, -this._findSide(ind, p2, p1), hull);
    }
}
