import { FloatArray, isArrayOfFloatArray } from "../../types";
import { Cartesian2, Cartesian3 } from "../geometry.cartesian";
import { IBounds2, ICartesian3, isArrayOfCartesianArray } from "../geometry.interfaces";
import { Polyline } from "./geometry.polyline";
import { IPolygon, ShapeType } from "./geometry.shapes.interfaces";

interface ICartesian3WithInfos extends ICartesian3 {
    __wayCode__$t1967: boolean; // true IN, false OUT. As we use this property to identify the intersection points we need to keep the name unique
    subject: Array<ICartesian3>;
    subjectIndex: number;
    clipIndex: number;
}

class Cartesian3WithInfos extends Cartesian3 implements ICartesian3WithInfos {
    constructor(x: number, y: number, z: number, public __wayCode__$t1967: boolean, public subject: Array<ICartesian3>, public subjectIndex: number, public clipIndex: number = 0) {
        super(x, y, z);
    }
}

function isIntersection(p: ICartesian3): p is ICartesian3WithInfos {
    return (p as ICartesian3WithInfos).__wayCode__$t1967 !== undefined;
}

export class Polygon extends Polyline implements IPolygon {
    public static IsClockWise(points: Array<ICartesian3>): boolean {
        let sum = 0;
        const n = points.length;
        for (let i = 0; i < points.length - 1; i++) {
            const a = points[i];
            const b = points[(i + 1) % n]; // %n ensure the last point is connected to the first one
            sum += (b.x - a.x) * (b.y + a.y);
        }
        return sum < 0;
    }

    public static FromFloats(points: FloatArray | Array<FloatArray>, stride: number = 3, assertClose: boolean = true, assertClockWize: boolean = true): IPolygon {
        if (isArrayOfFloatArray(points)) {
            const records = [];

            for (let i = 0; i < points.length; i++) {
                const tmp = points[i];
                const p: Array<ICartesian3> = [];
                for (let j = 0; j < tmp.length; j += stride) {
                    p.push(new Cartesian3(tmp[j], tmp[j + 1], stride > 2 ? tmp[j + 2] : 0));
                }
                records.push(p);
            }
            return Polygon.FromPoints(records, assertClose, assertClockWize);
        }
        const p: Array<ICartesian3> = [];
        for (let i = 0; i < points.length; i += stride) {
            p.push(new Cartesian3(points[i], points[i + 1], stride > 2 ? points[i + 2] : 0));
        }
        return new Polygon(p, assertClose, assertClockWize);
    }

    public static FromPoints(points: Array<ICartesian3> | Array<Array<ICartesian3>>, assertClose: boolean = true, assertClockWize: boolean = true): IPolygon {
        if (isArrayOfCartesianArray(points)) {
            const p = new Polygon(points[0], assertClose, assertClockWize);
            for (let i = 1; i < points.length; i++) {
                p.addHole(points[i], assertClose, assertClockWize);
            }
            return p;
        }
        return new Polygon(points, assertClose, assertClockWize);
    }

    _holes?: Array<Array<ICartesian3>>;

    protected constructor(p: Array<ICartesian3>, assertClose: boolean = true, assertClockWize: boolean = true) {
        super(p, ShapeType.Polygon);

        // force the polygon to be closed.
        if (assertClose && !Cartesian3.Equals(p[0], p[p.length - 1])) {
            p.push(p[0]);
        }

        // force the polygon to be clockwize
        if (assertClockWize && !Polygon.IsClockWise(p)) {
            p.reverse();
        }
    }

    public get holes(): Array<Array<ICartesian3>> | undefined {
        return this._holes;
    }

    public addHole(hole: Array<ICartesian3>, assertClose: boolean = true, assertAntiClockWize: boolean = true): void {
        if ((hole?.length ?? 0) > 2) {
            // force the polygon to be closed.
            if (assertClose && !Cartesian3.Equals(hole[0], hole[hole.length - 1])) {
                hole.push(hole[0]);
            }
            // force the polygon to be anticlockwise
            if (assertAntiClockWize && Polygon.IsClockWise(hole)) {
                hole.reverse();
            }
            this._holes = this._holes ?? [];
            this._holes.push(hole);
        }
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

    protected _clipPolygon(clipArea: IBounds2): IPolygon | Array<IPolygon> | undefined {
        if (clipArea.intersects(this.bounds)) {
            // 1 - Identify Intersection Points: Find all points where the subject polygon intersects with the clipping polygon.
            // These points should be inserted into both the subject and clipping polygons at their respective positions.
            // Each point in both polygons should be classified as either entering, exiting, or neither with respect to the other polygon.

            // the clip area as list of points
            const polygonArea = Array.from(clipArea.points()).map((p) => this._buildPoint(p.x, p.y, 0));
            polygonArea.push(polygonArea[0]); // close the polygon.

            // the polygons to clip
            const toClips = [this._points];
            if (this._holes) {
                toClips.push(...this._holes);
            }
            // keep trace of every entering intersection point
            const entering: Array<ICartesian3WithInfos> = [];

            // loop over each polygon to clip.
            // Remember that , the outer polygon is clockwise, the holes are anticlockwise
            for (const subject of toClips) {
                const points: Array<ICartesian3> = [];
                const codes = subject.map((p) => Cartesian2.ComputeCode(p, clipArea));
                let a = subject[0];
                let codea = codes[0];
                let inside: boolean = codea == 0;
                for (let i = 1; i < codes.length; i++) {
                    const b = subject[i];
                    const codeb = codes[i];

                    // keep this algorithm for lisibility
                    if (inside) {
                        points.push(this._buildPoint(a.x, a.y, a.z));
                        if (codeb != 0) {
                            // We EXIT THE bounds
                            const intersection = this._computeIntersectionToRef(clipArea, a, b, codeb, new Cartesian3WithInfos(0, 0, 0, false, points, points.length));
                            points.push(intersection);
                            intersection.clipIndex = this._InsertIntersectionIntoClipPolygon(polygonArea, intersection);
                            inside = !inside;
                        }
                    } else {
                        points.push(a); // we keep the original point while it will NOT be part of the new clipped polygon
                        if (codeb == 0) {
                            // We ENTER THE bounds
                            const intersection = this._computeIntersectionToRef(clipArea, a, b, codea, new Cartesian3WithInfos(0, 0, 0, true, points, points.length));
                            entering.push(intersection);
                            points.push(intersection);
                            intersection.clipIndex = this._InsertIntersectionIntoClipPolygon(polygonArea, intersection);
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
            }

            // 2 - Trace Output Polygons: Starting from an entering intersection point, trace along the subject polygon until another
            // intersection point is reached, then switch to the clipping polygon and continue tracing until the starting point is reached.
            // This forms one output polygon. Repeat this process starting from the next unvisited entering intersection point until all entering points have been visited.
            const polygons = [];
            if (entering.length != 0) {
                do {
                    const polygon = [];
                    // we pop the first entering point
                    const first = entering.splice(0, 1)[0];
                    let i: number = first.subjectIndex;
                    let subject = first.subject;
                    do {
                        const current = subject[i++];
                        i == subject.length && (i = 1); // loop, avoiding the first point
                        if (isIntersection(current)) {
                            polygon.push(this._buildPoint(current.x, current.y, current.z));

                            if (!current.__wayCode__$t1967) {
                                // we switch to the clip area
                                i = current.clipIndex + 1;
                                subject = polygonArea;
                                continue;
                            }

                            if (polygon.length == 1) {
                                continue;
                            }

                            if (current === first) {
                                // we found ONE polygon
                                polygons.push(polygon);
                                break;
                            }

                            // we switch to the subject
                            i = current.subjectIndex + 1;
                            subject = current.subject;
                            // we remove the current point from the entering list
                            entering.splice(
                                entering.findIndex((p) => p === current),
                                1
                            );
                            continue;
                        }
                        polygon.push(current);
                    } while (true);
                } while (entering.length > 0);
            }
            return polygons.length ? (polygons.length == 1 ? new Polygon(polygons[0], false, false) : polygons.map((p) => new Polygon(p, false, false))) : undefined;
        }
        return undefined;
    }

    protected _InsertIntersectionIntoClipPolygon(clipPolygon: Array<ICartesian3>, intersection: ICartesian3): number {
        let a = clipPolygon[0];
        for (let i = 1; i < clipPolygon.length; i++) {
            const b = clipPolygon[i];

            if (Cartesian3.IsWithinTheBounds(a, b, intersection)) {
                // insert the point between a and b
                clipPolygon.splice(i, 0, intersection);

                // update the clip index of the next points - add + 1
                for (let j = i + 1; j < clipPolygon.length; j++) {
                    const c = clipPolygon[j];
                    if (isIntersection(c)) {
                        c.clipIndex++;
                    }
                }
                return i;
            }
            a = b;
        }
        return -1;
    }
}
