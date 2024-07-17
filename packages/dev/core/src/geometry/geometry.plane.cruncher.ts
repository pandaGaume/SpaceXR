import { Nullable } from "../types";
import { Assert } from "../utils";
import { Cartesian2, Cartesian3 } from "./geometry.cartesian";
import { ICartesian2, ICartesian3, IPlane } from "./geometry.interfaces";

export class PlaneDefinition implements IPlane {
    private _point: ICartesian3;
    private _normal: ICartesian3;

    private _hull: Array<ICartesian3> = [];

    public constructor(p: ICartesian3, n: ICartesian3, hull: Array<ICartesian3>) {
        this._point = p;
        this._normal = n;
        this._hull = hull;
    }

    public get point(): ICartesian3 {
        return this._point;
    }

    public get normal(): ICartesian3 {
        return this._normal;
    }

    public get hull(): Array<ICartesian3> {
        return this._hull;
    }
}

class NormalGroup {
    public normal: ICartesian3;
    public indices: Set<number> = new Set<number>();
    public center: ICartesian3 = Cartesian3.Zero();

    public constructor(normal: ICartesian3) {
        this.normal = normal;
    }
}

export class PlaneCruncher {
    public static DEFAULT_TOLERANCE: number = 0.0001;

    private _positions: Nullable<Float32Array> = null;
    private _indices: Nullable<Uint32Array> = null;
    private _tolerance?: number;

    private _groups: Array<NormalGroup> = [];

    public withTolerance(tolerance: number): PlaneCruncher {
        this._tolerance = tolerance;
        return this;
    }

    public withPositions(positions: Float32Array): PlaneCruncher {
        this._positions = positions;
        return this;
    }

    public withIndices(indices: Uint32Array): PlaneCruncher {
        this._indices = indices;
        return this;
    }

    public crunch(): Array<PlaneDefinition> {
        Assert(this._positions !== null && this._indices !== null, "Positions and indices must be set before crunching.");
        this._buildGroups(this._tolerance ?? PlaneCruncher.DEFAULT_TOLERANCE);

        const planes: Array<PlaneDefinition> = [];
        for (let g of this._groups) {
            const t = this._createTranslationMatrix(g.center);
            const r = this._createRotationMatrix(g.normal);
            const m = this._multiplyMatrices(r, t);
            const inv = this._invertMatrix(m);

            const transformed = Array.from(g.indices).map((i) => {
                let p = Cartesian3.FromArray(this._positions!, i * 3);
                p = this._transformPoint(p, m);
                return { x: p.x, y: p.y };
            });

            const hull = this._grahamScan(transformed);

            const convertedHull = hull.map((p) => {
                const point = { x: p.x, y: p.y, z: 0 };
                return this._transformPoint(point, inv);
            });

            const p = new PlaneDefinition(g.center, g.normal, convertedHull);
            planes.push(p);
        }

        return planes;
    }

    private _buildGroups(epsilon?: number): void {
        if (this._positions === null || this._indices === null) return;
        for (let i = 0; i != this._indices?.length; i += 3) {
            const i1 = this._indices[i];
            const i2 = this._indices[i + 1];
            const i3 = this._indices[i + 2];

            const p1 = Cartesian3.FromArray(this._positions!, i1 * 3);
            const p2 = Cartesian3.FromArray(this._positions!, i2 * 3);
            const p3 = Cartesian3.FromArray(this._positions!, i3 * 3);

            const normal = Cartesian3.Normal(p1, p2, p3);

            let group = this._groups.find((g) => {
                if (Cartesian3.Equals(g.normal, normal, epsilon)) {
                    //const [first] = g.indices;
                    //const p4 = Cartesian3.FromArray(this._positions!, first * 3);
                    //if (Cartesian3.AreCoplanar(p1, p2, p3, p4, epsilon)) {
                    return true;
                    //}
                }
                return false;
            });

            if (group === undefined) {
                group = new NormalGroup(normal);
                this._groups.push(group);
            }

            group.indices.add(i1);
            group.indices.add(i2);
            group.indices.add(i3);
        }
        // compute the centroid
        for (let g of this._groups) {
            g.center = Cartesian3.Centroid(
                Array.from(g.indices).map((i) => Cartesian3.FromArray(this._positions!, i * 3)),
                g.center
            );
        }
    }

    protected _grahamScan(points: Array<ICartesian2>): Array<ICartesian2> {
        if (points.length < 3) {
            throw new Error("At least three points are required");
        }

        // Trouver le point avec la coordonnée y la plus basse (et la coordonnée x la plus basse en cas d'égalité)
        let startPoint = points[0];
        for (const point of points) {
            if (point.y < startPoint.y || (point.y === startPoint.y && point.x < startPoint.x)) {
                startPoint = point;
            }
        }

        // Trier les points par l'angle polaire par rapport à startPoint
        const sortedPoints = points.slice().sort((a, b) => {
            const angleA = Math.atan2(a.y - startPoint.y, a.x - startPoint.x);
            const angleB = Math.atan2(b.y - startPoint.y, b.x - startPoint.x);
            return angleA - angleB;
        });

        // Initialiser le hull avec les deux premiers points
        const hull: ICartesian2[] = [sortedPoints[0], sortedPoints[1]];

        for (let i = 2; i < sortedPoints.length; i++) {
            while (hull.length >= 2) {
                const top = hull[hull.length - 1];
                const nextToTop = hull[hull.length - 2];
                const cross = Cartesian2.Dot(Cartesian2.Subtract(top, nextToTop), Cartesian2.Subtract(sortedPoints[i], top));
                if (cross > 0) {
                    break;
                }
                hull.pop();
            }
            hull.push(sortedPoints[i]);
        }

        return hull;
    }

    private _createTranslationMatrix(p: ICartesian3): number[][] {
        return [
            [1, 0, 0, -p.x],
            [0, 1, 0, -p.y],
            [0, 0, 1, -p.z],
            [0, 0, 0, 1],
        ];
    }

    private _createRotationMatrix(n: ICartesian3): number[][] {
        const normalizedN = Cartesian3.Normalize(n);

        // Si le vecteur normal est déjà aligné avec l'axe Z
        if (Math.abs(normalizedN.x) < 1e-6 && Math.abs(normalizedN.y) < 1e-6 && Math.abs(normalizedN.z - 1) < 1e-6) {
            return [
                [1, 0, 0, 0],
                [0, 1, 0, 0],
                [0, 0, 1, 0],
                [0, 0, 0, 1],
            ];
        }

        const axis = { x: normalizedN.y, y: -normalizedN.x, z: 0 };
        const axisLength = Math.sqrt(axis.x * axis.x + axis.y * axis.y);
        if (axisLength !== 0) {
            axis.x /= axisLength;
            axis.y /= axisLength;
        }

        const cosTheta = normalizedN.z;
        const sinTheta = Math.sqrt(1 - cosTheta * cosTheta);
        const oneMinusCosTheta = 1 - cosTheta;

        const { x: u, y: v } = axis;

        return [
            [cosTheta + u * u * oneMinusCosTheta, u * v * oneMinusCosTheta, v * sinTheta, 0],
            [u * v * oneMinusCosTheta, cosTheta + v * v * oneMinusCosTheta, -u * sinTheta, 0],
            [-v * sinTheta, u * sinTheta, cosTheta, 0],
            [0, 0, 0, 1],
        ];
    }

    private _multiplyMatrices(a: number[][], b: number[][]): number[][] {
        const result = Array.from({ length: 4 }, () => Array(4).fill(0));

        for (let i = 0; i < 4; i++) {
            for (let j = 0; j < 4; j++) {
                for (let k = 0; k < 4; k++) {
                    result[i][j] += a[i][k] * b[k][j];
                }
            }
        }
        return result;
    }

    private _invertMatrix(matrix: number[][]): number[][] {
        // Assuming matrix is 4x4, implement Gauss-Jordan elimination or use a library for matrix inversion.
        // This is a simplified example assuming the matrix is invertible and is a 4x4 matrix.
        const m = JSON.parse(JSON.stringify(matrix)); // Deep copy to avoid mutating the original matrix
        const inv = [
            [1, 0, 0, 0],
            [0, 1, 0, 0],
            [0, 0, 1, 0],
            [0, 0, 0, 1],
        ];

        for (let i = 0; i < 4; i++) {
            let pivot = m[i][i];
            if (pivot === 0) {
                for (let j = i + 1; j < 4; j++) {
                    if (m[j][i] !== 0) {
                        [m[i], m[j]] = [m[j], m[i]];
                        [inv[i], inv[j]] = [inv[j], inv[i]];
                        pivot = m[i][i];
                        break;
                    }
                }
            }
            for (let j = 0; j < 4; j++) {
                m[i][j] /= pivot;
                inv[i][j] /= pivot;
            }
            for (let j = 0; j < 4; j++) {
                if (i !== j) {
                    const factor = m[j][i];
                    for (let k = 0; k < 4; k++) {
                        m[j][k] -= factor * m[i][k];
                        inv[j][k] -= factor * inv[i][k];
                    }
                }
            }
        }
        return inv;
    }

    private _transformPoint(point: ICartesian3, transformationMatrix: number[][]): ICartesian3 {
        const pointHomogeneous = [point.x, point.y, point.z, 1];
        const transformedPointHomogeneous = [0, 0, 0, 0];

        for (let i = 0; i < 4; i++) {
            for (let j = 0; j < 4; j++) {
                transformedPointHomogeneous[i] += transformationMatrix[i][j] * pointHomogeneous[j];
            }
        }

        return {
            x: transformedPointHomogeneous[0] / transformedPointHomogeneous[3],
            y: transformedPointHomogeneous[1] / transformedPointHomogeneous[3],
            z: transformedPointHomogeneous[2] / transformedPointHomogeneous[3],
        };
    }
}
