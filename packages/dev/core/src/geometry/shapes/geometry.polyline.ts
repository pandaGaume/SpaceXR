import { FloatArray, isArrayOfFloatArray } from "../../types";
import { Bounds2 } from "../geometry.bounds";
import { Cartesian2, Cartesian3 } from "../geometry.cartesian";
import { IBounds2, ICartesian3, isArrayOfCartesianArray, RegionCode } from "../geometry.interfaces";
import { AbstractShape } from "./geometry.shape";
import { IPolyline, ShapeType } from "./geometry.shapes.interfaces";

export class Polyline extends AbstractShape implements IPolyline {
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

    public clip(clipArea: IBounds2): IPolyline | Array<IPolyline> | undefined {
        if (clipArea.containsBounds(this.bounds)) {
            return this;
        }
        return this._clipPolyline(clipArea);
    }

    protected _clipPolyline(clipArea: IBounds2): IPolyline | Array<IPolyline> | undefined {
        if (clipArea.intersects(this.bounds)) {
            const polylines = [];
            let points = [];
            const codes = this._points.map((p) => Cartesian2.ComputeCode(p, clipArea));
            let a = this._points[0];
            let codea = codes[0];
            let inside: boolean = codea == 0;
            for (let i = 1; i < codes.length; i++) {
                const b = this._points[i];
                const codeb = codes[i];

                // keep this algorithm for lisibility
                if (inside) {
                    points.push(this._buildPoint(a.x, a.y, a.z));
                    if (codeb != 0) {
                        const intersection = this._computeIntersectionToRef(clipArea, a, b, codeb, this._buildPoint(0, 0, 0));
                        points.push(intersection);
                        polylines.push(new Polyline(points));
                        points = [];
                        inside = !inside;
                    }
                } else {
                    if (codeb == 0) {
                        const intersection = this._computeIntersectionToRef(clipArea, a, b, codea, this._buildPoint(0, 0, 0));
                        points.push(intersection);
                        inside = !inside;
                    }
                }
                a = b;
                codea = codeb;
            }
            // add last points
            if (inside) {
                points.push(this._buildPoint(a.x, a.y, a.z));
            }
            // add last polyline
            if (points.length) {
                polylines.push(new Polyline(points));
            }
            return polylines.length ? (polylines.length == 1 ? polylines[0] : polylines) : undefined;
        }
        return undefined;
    }

    protected _computeIntersectionToRef<T extends ICartesian3>(clipArea: IBounds2, a: ICartesian3, b: ICartesian3, code_out: RegionCode, ref: T): T {
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

    protected _buildBounds(): IBounds2 | undefined {
        return Bounds2.FromPoints(...this._points);
    }
}
