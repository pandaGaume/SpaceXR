import { FloatArray, isArrayOfFloatArray } from "../../types";
import { Bounds } from "../geometry.bounds";
import { Cartesian3 } from "../geometry.cartesian";
import { IBounds, ICartesian3, isArrayOfCartesianArray, RegionCode } from "../geometry.interfaces";
import { AbstractShape } from "./geometry.shape";
import { IPolyline, ShapeType } from "./geometry.shapes.interfaces";

export class Polyline extends AbstractShape implements IPolyline {
    public static Concat(...p: Array<IPolyline>): IPolyline {
        const points: Array<ICartesian3> = [];

        for (let i = 0; i < p.length; i++) {
            const polyPoints = p[i].points.map((pt) => new Cartesian3(pt.x, pt.y, pt.z));

            if (i > 0 && points.length > 0) {
                const lastPoint = points[points.length - 1];
                const firstNewPoint = polyPoints[0];

                // Compare coordinates to avoid duplication
                if (lastPoint.x === firstNewPoint.x && lastPoint.y === firstNewPoint.y && lastPoint.z === firstNewPoint.z) {
                    // Skip the first point of the current polyline
                    polyPoints.shift();
                }
            }

            points.push(...polyPoints);
        }

        return new Polyline(points);
    }

    public static ArraysEqual(arr1: FloatArray, arr2: FloatArray): boolean {
        if (arr1.length !== arr2.length) {
            return false;
        }

        for (let i = 0; i < arr1.length; i++) {
            if (arr1[i] !== arr2[i]) {
                return false;
            }
        }

        return true;
    }

    public static FromFloats(points: FloatArray | Array<FloatArray>, stride: number = 3): IPolyline | Array<IPolyline> {
        if (isArrayOfFloatArray(points)) {
            const multipolyline = [];
            for (let i = 0; i < points.length; i++) {
                const tmp = points[i];
                const p: Array<ICartesian3> = [];
                for (let j = 0; j < tmp.length; j += stride) {
                    p.push(new Cartesian3(tmp[j], tmp[j + 1], stride > 2 ? tmp[j + 2] : 0));
                }
                multipolyline.push(new Polyline(p));
            }
            return multipolyline;
        }
        const p: Array<ICartesian3> = [];
        for (let i = 0; i < points.length; i += stride) {
            p.push(new Cartesian3(points[i], points[i + 1], stride > 2 ? points[i + 2] : 0));
        }
        return new Polyline(p);
    }

    public static FromPoints(points: Array<ICartesian3> | Array<Array<ICartesian3>>): IPolyline {
        if (isArrayOfCartesianArray(points)) {
            return Polyline.FromPoints(points.flat());
        }
        return new Polyline(points);
    }

    protected _points: Array<ICartesian3>;

    protected constructor(p: Array<ICartesian3>, type?: ShapeType) {
        super(type ?? ShapeType.Polyline);
        this._points = p;
    }

    public get points(): Array<ICartesian3> {
        return this._points;
    }

    public clip(clipArea: IBounds): IPolyline | Array<IPolyline> | undefined {
        if (clipArea.containsBounds(this.boundingBox)) {
            return this;
        }
        return this._clipPolyline(clipArea);
    }

    protected _clipPolyline(clipArea: IBounds): IPolyline | Array<IPolyline> | undefined {
        const polylines: IPolyline[] = [];
        let points: ICartesian3[] = [];
        const flush = () => {
            if (points.length > 1) polylines.push(new Polyline(points));
            points = [];
        };
        // Clip each XY segment parametrically, including outside-to-outside crossings.
        for (let i = 1; i < this._points.length; i++) {
            const a = this._points[i - 1],
                b = this._points[i];
            let start = 0,
                end = 1;
            for (const [origin, delta, min, max] of [
                [a.x, b.x - a.x, clipArea.xmin, clipArea.xmax],
                [a.y, b.y - a.y, clipArea.ymin, clipArea.ymax],
            ]) {
                if (delta === 0) {
                    if (origin < min || origin > max) end = -1;
                } else {
                    const t0 = (min - origin) / delta,
                        t1 = (max - origin) / delta;
                    start = Math.max(start, Math.min(t0, t1));
                    end = Math.min(end, Math.max(t0, t1));
                }
            }
            if (end <= start) {
                flush();
                continue;
            }
            const at = (t: number) => this._buildPoint(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t, a.z + (b.z - a.z) * t);
            if (start > 0) flush();
            if (!points.length) points.push(at(start));
            points.push(at(end));
            if (end < 1) flush();
        }
        flush();
        return polylines.length === 1 ? polylines[0] : polylines.length ? polylines : undefined;
    }

    protected _computeIntersectionToRef<T extends ICartesian3>(clipArea: IBounds, a: ICartesian3, b: ICartesian3, code_out: RegionCode, ref: T): T {
        // compute intersection point
        const x1 = a.x;
        const y1 = a.y;
        const x2 = b.x;
        const y2 = b.y;

        if (code_out & RegionCode.TOP) {
            const y_max = clipArea.ymax;
            // point is above the clip rectangle
            ref.x = x1 + ((x2 - x1) * (y_max - y1)) / (y2 - y1);
            ref.y = y_max;
        } else if (code_out & RegionCode.BOTTOM) {
            // point is below the rectangle
            const y_min = clipArea.ymin;
            ref.x = x1 + ((x2 - x1) * (y_min - y1)) / (y2 - y1);
            ref.y = y_min;
        } else if (code_out & RegionCode.RIGHT) {
            // point is to the right of rectangle
            const x_max = clipArea.xmax;
            ref.y = y1 + ((y2 - y1) * (x_max - x1)) / (x2 - x1);
            ref.x = x_max;
        } else if (code_out & RegionCode.LEFT) {
            // point is to the left of rectangle
            const x_min = clipArea.xmin;
            ref.y = y1 + ((y2 - y1) * (x_min - x1)) / (x2 - x1);
            ref.x = x_min;
        }
        return ref;
    }

    protected _buildPoint(x?: number, y?: number, z?: number): ICartesian3 {
        return new Cartesian3(x ?? 0, y ?? 0, z ?? 0);
    }

    protected _buildBounds(): IBounds | undefined {
        return Bounds.FromPoints2(...this._points);
    }
    protected _getPoints(): Array<ICartesian3> {
        return this._points;
    }
}
