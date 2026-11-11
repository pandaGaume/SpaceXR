import { GeodeticSystem } from "@spacexr/geodesy";

/** Vector with ECEF components. */
export interface IEcefVector {
    x: number;
    y: number;
    z: number;
}

/**
 * Unit normal of a Web Mercator DEM surface in ECEF.
 *
 * @param gradient - Height gradient in metres per normalized pyramid unit along `x` eastward and `y` southward, as
 *     returned by `DemPyramid.surfaceGradient`.
 * @param up - Unit ellipsoid normal at the point.
 * @param verticalScale - Factor applied to heights. Defaults to 1.
 * @param semiMajorAxis - Equatorial radius in metres. Defaults to WGS84.
 * @returns The normal, or `up` at the poles where east and north are undefined.
 */
export function webMercatorSurfaceNormal(
    gradient: readonly [number, number],
    up: IEcefVector,
    verticalScale = 1,
    semiMajorAxis = GeodeticSystem.WGS84.ellipsoid.semiMajorAxis
): IEcefVector {
    const horizontal = Math.hypot(up.x, up.y);
    if (horizontal === 0) return { x: up.x, y: up.y, z: up.z };
    // East and north of the local tangent plane.
    const eastX = -up.y / horizontal;
    const eastY = up.x / horizontal;
    const northX = -up.z * eastY;
    const northY = up.z * eastX;
    const northZ = up.x * eastY - up.y * eastX;
    // Web Mercator is conformal: one normalized unit spans the circumference times cos(latitude) on the ground.
    const metres = 2 * Math.PI * semiMajorAxis * horizontal;
    const slopeEast = (gradient[0] * verticalScale) / metres;
    // Map rows grow southward.
    const slopeNorth = (-gradient[1] * verticalScale) / metres;
    const x = up.x - slopeEast * eastX - slopeNorth * northX;
    const y = up.y - slopeEast * eastY - slopeNorth * northY;
    const z = up.z - slopeNorth * northZ;
    const length = Math.hypot(x, y, z);
    return { x: x / length, y: y / length, z: z / length };
}
