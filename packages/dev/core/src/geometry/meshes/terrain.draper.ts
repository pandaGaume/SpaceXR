import { Cartesian3, Cartesian4, ICartesian3, ICartesian4,IPolyline, isLine, Line, Polyline } from "../index";
import { IVerticesData } from "./meshes.interfaces";
import { Nullable } from "../../types";



export class TerrainNormalizedDraper {
 
    public constructor() {
    }

    public drapNoramalizedPolyline(heightmap: IVerticesData, polyline: IPolyline): IPolyline | undefined {
        let drappedPoints: Nullable<IPolyline> = null;
        for (let i = 0; i < polyline.points.length - 1; i++) {
            const p0 = polyline.points[i];
            const p1 = polyline.points[i + 1];
            const segment = new Line(p0, p1);
            const drappedSegment = this.drapNormalizedLine(heightmap, segment);
            if (drappedSegment) {
                drappedPoints = drappedPoints ? Polyline.Concat(drappedPoints, drappedSegment) : drappedSegment;
            }
        }
        return drappedPoints || undefined;
    }

    // Drapes a 3D line over a heightmap represented as a triangle mesh (IVerticesData).
    // The line's XY coordinates are projected onto the heightmap, and the Z coordinate is sampled from the heightmap.
    // The output polyline contains 4D points (ICartesian4) where w is the normalized parameter along the input line [0,1].
    // This version is a brute-force implementation and may not be optimal for large datasets. It can be improved with spatial indexing.
    public drapNormalizedLine(heightmap: IVerticesData, line: Line): IPolyline | undefined {
        if (!heightmap.indices || !heightmap.positions) {
            return undefined;
        }

        const va = Cartesian3.Zero();
        const vb = Cartesian3.Zero();
        const vc = Cartesian3.Zero();

        const segment = Line.Zero();
        const drapped: Array<ICartesian4> = [];

        // Direction and length of the input line (used to normalize w)
        const lineDir = Cartesian3.Subtract(line.end, line.start);
        const lineLen2 = Cartesian3.Dot(lineDir, lineDir);
        const lineLen = Math.sqrt(lineLen2);
        if (lineLen < 1e-6) {
            // Degenerate line
            return undefined;
        }

        const tmp = Cartesian3.Zero();
        const tmp2 = Cartesian3.Zero();

        // Small helper to add a draped point, given only its XY on the line
        const pushDrapedPointFromXY = (px: number, py: number, vaEdge: ICartesian3, vbEdge: ICartesian3) => {

            // Interpolate Z along edge vaEdge -> vbEdge
            const edgeDir = Cartesian3.SubtractToRef(vbEdge, vaEdge, tmp);
            const edgeLen2 = Cartesian3.Dot(edgeDir, edgeDir);
            const dz = vbEdge.z - vaEdge.z;

            let s = 0;
            if (edgeLen2 > 1e-12) {
                const pVec = Cartesian3.SubtractToRef({ x: px, y: py, z: 0 }, vaEdge, tmp2);
                s = Cartesian3.Dot(pVec, edgeDir) / edgeLen2;
            }
            const z = vaEdge.z + dz * s;

            // Parameter along the original line, normalized in [0,1]
            const pOnLineVec = Cartesian3.SubtractToRef({ x: px, y: py, z }, line.start, tmp2);
            const t = Cartesian3.Dot(pOnLineVec, lineDir) / lineLen2;
            const w = t; // normalized [0,1] along line

            const p4 = new Cartesian4(px, py, z, w);
            drapped.push(p4);
        };

        // 1) Collect all intersections between the line and the heightmap edges
        for (let i = 0; i < heightmap.indices.length;) {
            const i0 = heightmap.indices[i++];
            const i1 = heightmap.indices[i++];
            const i2 = heightmap.indices[i++];

            const vertices = [
                Cartesian3.FromArrayToRef(heightmap.positions, i0 * 3, 3, va),
                Cartesian3.FromArrayToRef(heightmap.positions, i1 * 3, 3, vb),
                Cartesian3.FromArrayToRef(heightmap.positions, i2 * 3, 3, vc),
            ];

            // For each edge of the triangle
            for (let j = 0; j < 3; j++) {
                const vaEdge = vertices[j];
                const vbEdge = vertices[(j + 1) % 3];

                // Segment in XY for intersection
                segment.start.x = vaEdge.x;
                segment.start.y = vaEdge.y;
                segment.end.x = vbEdge.x;
                segment.end.y = vbEdge.y;

                const result = segment.intersect(line); // your robust 3D/2DXY intersection

                if (!result) {
                    continue;
                }

                if (isLine(result)) {
                    // Intersection is a segment: two endpoints
                    pushDrapedPointFromXY(result.start.x, result.start.y, vaEdge, vbEdge);
                    pushDrapedPointFromXY(result.end.x, result.end.y, vaEdge, vbEdge);
                } else {
                    // Single intersection point
                    pushDrapedPointFromXY(result.position.x, result.position.y, vaEdge, vbEdge);
                }
            }
        }

        // 2) Also add the line start and end, draped on the heightmap
        const pushEndpointIfInside = (endpoint: ICartesian3, wNorm: number) => {
            const z = this._sampleHeightAtXY(heightmap, endpoint.x, endpoint.y);
            if (z === undefined) {
                // endpoint is outside the heightmap domain
                return;
            }
            const p4 = new Cartesian4(endpoint.x, endpoint.y, z, wNorm);
            drapped.push(p4);
        };

        // w = 0 for start, w = 1 for end
        pushEndpointIfInside(line.start, 0.0);
        pushEndpointIfInside(line.end, 1.0);

        if (drapped.length === 0) {
            return undefined;
        }

        // 3) Sort points along the line using normalized w in ascending order
        drapped.sort((a, b) => a.w - b.w);

        // 4) Remove duplicates based on w
        const EPS = 1e-6;
        const unique: Array<ICartesian4> = [];
        let lastW: number | null = null;

        for (const p of drapped) {
            if (lastW === null || Math.abs(p.w - lastW) > EPS) {
                unique.push(p);
                lastW = p.w;
            }
        }

        return Polyline.FromPoints(unique);
    }

    private _sampleHeightAtXY(heightmap: IVerticesData, x: number, y: number): number | undefined {
        if (!heightmap.indices || !heightmap.positions) {
            return undefined;
        }

        const va = Cartesian3.Zero();
        const vb = Cartesian3.Zero();
        const vc = Cartesian3.Zero();

        const p = { x, y, z: 0 };

        for (let i = 0; i < heightmap.indices.length;) {
            const i0 = heightmap.indices[i++];
            const i1 = heightmap.indices[i++];
            const i2 = heightmap.indices[i++];

            const a = Cartesian3.FromArrayToRef(heightmap.positions, i0 * 3, 3, va);
            const b = Cartesian3.FromArrayToRef(heightmap.positions, i1 * 3, 3, vb);
            const c = Cartesian3.FromArrayToRef(heightmap.positions, i2 * 3, 3, vc);

            if (this._pointInTriangleXY(p, a, b, c)) {
                // compute barycentric coords in XY
                const z = this._interpolateZFromTriangleXY(p, a, b, c);
                return z;
            }
        }

        return undefined;
    }

    private _pointInTriangleXY(p: ICartesian3, a: ICartesian3, b: ICartesian3, c: ICartesian3, eps: number = 1e-6): boolean {
        // Barycentric point-in-triangle test in XY
        const v0x = b.x - a.x;
        const v0y = b.y - a.y;
        const v1x = c.x - a.x;
        const v1y = c.y - a.y;
        const v2x = p.x - a.x;
        const v2y = p.y - a.y;

        const dot00 = v0x * v0x + v0y * v0y;
        const dot01 = v0x * v1x + v0y * v1y;
        const dot02 = v0x * v2x + v0y * v2y;
        const dot11 = v1x * v1x + v1y * v1y;
        const dot12 = v1x * v2x + v1y * v2y;

        const denom = dot00 * dot11 - dot01 * dot01;
        if (Math.abs(denom) < eps) {
            return false;
        }

        const invDenom = 1.0 / denom;
        const u = (dot11 * dot02 - dot01 * dot12) * invDenom;
        const v = (dot00 * dot12 - dot01 * dot02) * invDenom;

        return u >= -eps && v >= -eps && u + v <= 1 + eps;
    }

    private _interpolateZFromTriangleXY(p: ICartesian3, a: ICartesian3, b: ICartesian3, c: ICartesian3): number {
        // Same barycentric computation as above, to get weights for z
        const v0x = b.x - a.x;
        const v0y = b.y - a.y;
        const v1x = c.x - a.x;
        const v1y = c.y - a.y;
        const v2x = p.x - a.x;
        const v2y = p.y - a.y;

        const dot00 = v0x * v0x + v0y * v0y;
        const dot01 = v0x * v1x + v0y * v1y;
        const dot02 = v0x * v2x + v0y * v2y;
        const dot11 = v1x * v1x + v1y * v1y;
        const dot12 = v1x * v2x + v1y * v2y;

        const denom = dot00 * dot11 - dot01 * dot01;
        const invDenom = 1.0 / denom;

        const u = (dot11 * dot02 - dot01 * dot12) * invDenom;
        const v = (dot00 * dot12 - dot01 * dot02) * invDenom;
        const w = 1.0 - u - v;

        return a.z * w + b.z * u + c.z * v;
    }

}