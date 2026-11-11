import type { Ellipsoid, ICartesian3 } from "@spacexr/geodesy";

import type { ITileAddress } from "../addressing/tile-address";
import { cubeTileDirection } from "./cube-mapping";

/**
 * Reference surface of a celestial body: a triaxial ellipsoid with radii `a`, `b`, `c` along the `X`, `Y` and `Z`
 * axes of its body-fixed frame, in metres. Terrain heights are radial: the point of direction `d` and height `h` is
 * `(radius(d) + h) * d`. No geodetic latitude is involved, so triaxial bodies need no special case.
 */
export class ReferenceSurface {
    public readonly radii: readonly [number, number, number];
    private readonly inverseSquares: readonly [number, number, number];

    /**
     * @param a - Radius along `X`, in metres.
     * @param b - Radius along `Y`, in metres.
     * @param c - Radius along `Z`, the polar radius, in metres.
     * @throws RangeError When a radius is not a positive finite number.
     */
    public constructor(a: number, b: number, c: number) {
        for (const radius of [a, b, c]) {
            if (!Number.isFinite(radius) || radius <= 0) throw new RangeError("The radii of a reference surface must be positive finite metres.");
        }
        this.radii = Object.freeze([a, b, c] as const);
        this.inverseSquares = [1 / (a * a), 1 / (b * b), 1 / (c * c)];
    }

    /** A sphere of the given radius, in metres. */
    public static sphere(radius: number): ReferenceSurface {
        return new ReferenceSurface(radius, radius, radius);
    }

    /** The biaxial surface of an ellipsoid: its semi-major axis along `X` and `Y`, its semi-minor axis along `Z`. */
    public static fromEllipsoid(ellipsoid: Ellipsoid): ReferenceSurface {
        return new ReferenceSurface(ellipsoid.semiMajorAxis, ellipsoid.semiMajorAxis, ellipsoid.semiMinorAxis);
    }

    /**
     * Distance from the centre to the surface along a unit direction: `1 / sqrt(x^2 / a^2 + y^2 / b^2 + z^2 / c^2)`.
     */
    public radius(direction: Readonly<ICartesian3>): number {
        const [ia, ib, ic] = this.inverseSquares;
        const { x, y, z } = direction;
        return 1 / Math.sqrt(x * x * ia + y * y * ib + z * z * ic);
    }

    /**
     * Point of a unit direction at a radial height: `(radius(direction) + height) * direction`.
     *
     * @param height - Radial height above the surface, in metres.
     * @param target - Receives the point.
     */
    public point(direction: Readonly<ICartesian3>, height = 0, target: ICartesian3 = { x: 0, y: 0, z: 0 }): ICartesian3 {
        const distance = this.radius(direction) + height;
        target.x = direction.x * distance;
        target.y = direction.y * distance;
        target.z = direction.z * distance;
        return target;
    }

    /**
     * Radial height of a point above the surface: its distance to the centre minus the radius of its direction.
     *
     * @throws RangeError When the point is the centre or is not finite.
     */
    public height(point: Readonly<ICartesian3>): number {
        const distance = Math.hypot(point.x, point.y, point.z);
        if (!(distance > 0) || !Number.isFinite(distance)) throw new RangeError("The height of the centre is undefined.");
        return distance - this.radius({ x: point.x / distance, y: point.y / distance, z: point.z / distance });
    }

    /**
     * Unit normal of the surface at a point of it, `normalize(x / a^2, y / b^2, z / c^2)`. It differs from the radial
     * direction on a non-spherical surface. For a point off the surface it is the normal of the scaled surface through
     * that point.
     *
     * @param target - Receives the normal.
     */
    public normal(point: Readonly<ICartesian3>, target: ICartesian3 = { x: 0, y: 0, z: 0 }): ICartesian3 {
        const [ia, ib, ic] = this.inverseSquares;
        const x = point.x * ia;
        const y = point.y * ib;
        const z = point.z * ic;
        const length = Math.hypot(x, y, z);
        target.x = x / length;
        target.y = y / length;
        target.z = z / length;
        return target;
    }
}

const CORNERS: ReadonlyArray<readonly [number, number]> = [
    [0, 0],
    [1, 0],
    [1, 1],
    [0, 1],
];

/**
 * Geometric error of a terrain tile of the cube index: the longest of its four edges, measured as the chord between
 * its corners on the reference surface, divided by the cells of a tile side. It follows the distortion of the cube
 * instead of assuming one size per level.
 *
 * @param tileSize - Cells per tile side.
 * @throws RangeError When the address is invalid or the tile size is not positive.
 */
export function cubeTileGeometricError(address: ITileAddress, surface: ReferenceSurface, tileSize: number): number {
    if (!(tileSize > 0)) throw new RangeError("The tile size must be positive.");
    const points = CORNERS.map(([s, t]) => surface.point(cubeTileDirection(address, s, t)));
    let longest = 0;
    for (let index = 0; index < 4; index++) {
        const a = points[index]!;
        const b = points[(index + 1) % 4]!;
        longest = Math.max(longest, Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z));
    }
    return longest / tileSize;
}
