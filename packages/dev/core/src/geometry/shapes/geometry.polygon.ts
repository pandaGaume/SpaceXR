import { Cartesian3 } from "../geometry.cartesian";
import { IBounds2, ICartesian3, RegionCode } from "../geometry.interfaces";
import { Polyline } from "./geometry.polyline";
import { IPolygon, ShapeType } from "./geometry.shapes.interfaces";

enum WayCode {
    In,
    Out,
}

interface ICartesian3WithInfos extends ICartesian3 {
    code: WayCode;
    subjectIndex: number;
    clipIndex: number;
}

class Cartesian3WithInfos extends Cartesian3 implements ICartesian3WithInfos {
    constructor(x: number, y: number, z: number, public code: WayCode, public subjectIndex: number, public clipIndex: number = 0) {
        super(x, y, z);
    }
}

function isIntersection(p: ICartesian3): p is ICartesian3WithInfos {
    return (p as ICartesian3WithInfos).code !== undefined && (p as ICartesian3WithInfos).subjectIndex !== undefined;
}

export class Polygon extends Polyline implements IPolygon {
    _clockWise?: boolean;

    public constructor(p: Array<ICartesian3>, clockWise?: boolean) {
        super(p, ShapeType.Polygon);

        // forec the polygon to be closed.
        if (!Cartesian3.Equals(p[0], p[p.length - 1])) {
            p.push(this._buildPoint(p[0].x, p[0].y, p[0].z));
        }

        // force the polygon to be clock wise
        this._clockWise = clockWise ?? this._isClockWise();
        if (this._clockWise == false) {
            this.reverseInPlace();
        }
    }

    public get isClockWise(): boolean {
        if (this._clockWise === undefined) {
            this._clockWise = this._isClockWise();
        }
        return this._clockWise;
    }

    /// <summary>
    /// Clip the polygon with the given area. This is a bit more complex than the polyline clip
    /// because we eventually close polygons bounds with the bounds itselfs, then may obtains several polygons.
    /// </summary>
    public clip(clipArea: IBounds2): IPolygon | Array<IPolygon> | undefined {
        if (clipArea.containsBounds(this.bounds)) {
            return this;
        }

        return this._clipPolygon(clipArea);
    }

    public reverseInPlace(): IPolygon {
        this._points.reverse();
        if (this._clockWise !== undefined) {
            this._clockWise = !this._clockWise;
        }
        return this;
    }

    protected _clipPolygon(clipArea: IBounds2): IPolygon | Array<IPolygon> | undefined {
        if (clipArea.intersects(this.bounds)) {
            // 1 - Identify Intersection Points: Find all points where the subject polygon intersects with the clipping polygon.
            // These points should be inserted into both the subject and clipping polygons at their respective positions.
            // Each point in both polygons should be classified as either entering, exiting, or neither with respect to the other polygon.
            const points: Array<ICartesian3> = [];
            const entering: Array<ICartesian3WithInfos> = [];
            const codes = this._points.map((p) => p.computeCode(clipArea));
            const polygonArea = new Polygon(
                Array.from(clipArea.points()).map((p) => this._buildPoint(p.x, p.y, 0)),
                true
            );
            let a = this._points[0];
            let codea = codes[0];
            let inside: boolean = codea == 0;
            for (let i = 1; i < codes.length; i++) {
                const b = this._points[i];
                const codeb = codes[i];

                // keep this algorithm for lisibility
                points.push(this._buildPoint(a.x, a.y, a.z));
                if (inside) {
                    if (codeb != 0) {
                        // We EXIT THE bounds
                        const intersection = this._computeIntersectionToRef(clipArea, a, b, codeb, new Cartesian3WithInfos(0, 0, 0, WayCode.Out, points.length));
                        points.push(intersection);
                        intersection.clipIndex = this._findClipIndex(polygonArea, intersection);
                        polygonArea.points.splice(intersection.clipIndex, 0, intersection);
                        inside = !inside;
                    }
                } else {
                    if (codeb == 0) {
                        // We ENTER THE bounds
                        const intersection = this._computeIntersectionToRef(clipArea, a, b, codeb, new Cartesian3WithInfos(0, 0, 0, WayCode.In, points.length));
                        entering.push(intersection);
                        points.push(intersection);
                        intersection.clipIndex = this._findClipIndex(polygonArea, intersection);
                        inside = !inside;
                    }
                }
                a = b;
                codea = codeb;
            }

            // 2 - Trace Output Polygons: Starting from an entering intersection point, trace along the subject polygon until another
            // intersection point is reached, then switch to the clipping polygon and continue tracing until the starting point is reached.
            // This forms one output polygon. Repeat this process starting from the next unvisited entering intersection point until all entering points have been visited.
            if (entering.length == 0) {
                do {
                    const polygon = [];
                    const first = entering.splice(0, 1)[0];
                    let i = first.subjectIndex;
                    do {
                        const current = points[i];
                        if (isIntersection(current)) {
                            polygon.push(this._buildPoint(current.x, current.y, current.z));
                            if (current.code == WayCode.Out) {
                                // we switch to the clip area
                            }
                            continue;
                        }
                        polygon.push(points[i]);
                    } while (i > points.length);
                } while (entering.length > 0);
            }
        }
        return undefined;
    }

    protected _findClipIndex(clipPoly: IPolygon, p: ICartesian3): number {
        let a = clipPoly.points[0];
        for (let i = 1; i < clipPoly.points.length; i++) {
            const b = clipPoly.points[i];

            if (Cartesian3.IsWithinTheBounds(a, b, p)) {
                return i;
            }
            a = b;
        }
        return -1;
    }

    protected _isClockWise(): boolean {
        let sum = 0;
        for (let i = 0; i < this._points.length - 1; i++) {
            const a = this._points[i];
            const b = this._points[i + 1];
            sum += (b.x - a.x) * (b.y + a.y);
        }
        return sum > 0;
    }
}
