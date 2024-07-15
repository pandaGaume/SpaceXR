/*
 from (c) 2017, Vladimir Agafonkin
*/
import { ICartesian2 } from "./geometry.interfaces";

export class PolylineSimplifier<T extends ICartesian2> {
    public static DEFAULT_TOLERANCE = 1;

    public static Shared = new PolylineSimplifier<ICartesian2>();

    _tolerance: number;
    _highestQuality: boolean;

    public constructor(tolerance: number = PolylineSimplifier.DEFAULT_TOLERANCE, highestQuality: boolean = false) {
        this._tolerance = tolerance;
        this._highestQuality = highestQuality;
    }

    public simplify(points: Array<T>, tolerance?: number, highestQuality?: boolean): Array<T> {
        if (points.length <= 2) return points;
        const toleranceValue = tolerance ?? this._tolerance;
        const highestQualityValue = highestQuality ?? this._highestQuality;
        points = highestQualityValue ? points : this._simplifyDouglasPeucker(points, toleranceValue);
        return this._simplifyRadialDist(points, this._tolerance);
    }

    protected _simplifyRadialDist(points: Array<T>, sqTolerance: number): Array<T> {
        let prevPoint: T = points[0],
            newPoints: Array<T> = [prevPoint],
            point: T = prevPoint;

        for (var i = 1, len = points.length; i < len; i++) {
            point = points[i];

            if (this._getSqDist(point, prevPoint) > sqTolerance) {
                newPoints.push(point);
                prevPoint = point;
            }
        }

        if (prevPoint !== point) newPoints.push(point);

        return newPoints;
    }

    protected _simplifyDouglasPeucker(points: Array<T>, sqTolerance: number): Array<T> {
        var last = points.length - 1;

        var simplified = [points[0]];
        this._simplifyDPStep(points, 0, last, sqTolerance, simplified);
        simplified.push(points[last]);

        return simplified;
    }

    protected _getSqDist(p1: T, p2: T): number {
        var dx = p1.x - p2.x,
            dy = p1.y - p2.y;

        return dx * dx + dy * dy;
    }

    protected _getSqSegDist(p: T, p1: T, p2: T): number {
        var x = p1.x,
            y = p1.y,
            dx = p2.x - x,
            dy = p2.y - y;

        if (dx !== 0 || dy !== 0) {
            var t = ((p.x - x) * dx + (p.y - y) * dy) / (dx * dx + dy * dy);

            if (t > 1) {
                x = p2.x;
                y = p2.y;
            } else if (t > 0) {
                x += dx * t;
                y += dy * t;
            }
        }

        dx = p.x - x;
        dy = p.y - y;

        return dx * dx + dy * dy;
    }

    protected _simplifyDPStep(points: Array<T>, first: any, last: any, sqTolerance: number, simplified: Array<T>) {
        var maxSqDist = sqTolerance,
            index;

        for (var i = first + 1; i < last; i++) {
            var sqDist = this._getSqSegDist(points[i], points[first], points[last]);

            if (sqDist > maxSqDist) {
                index = i;
                maxSqDist = sqDist;
            }
        }

        if (maxSqDist > sqTolerance) {
            if (index - first > 1) this._simplifyDPStep(points, first, index, sqTolerance, simplified);
            simplified.push(points[index]);
            if (last - index > 1) this._simplifyDPStep(points, index, last, sqTolerance, simplified);
        }
    }
}
