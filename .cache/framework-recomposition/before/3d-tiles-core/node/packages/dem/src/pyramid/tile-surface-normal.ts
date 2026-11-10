import type { GeodeticSystem } from "@spacexr/geodesy";
import type { ICartesian3, ITileAddress, ITileSurface, ReferenceSurface } from "@spacexr/tiles";

/**
 * Unit normal of a displaced surface on a tile of any surface, from the positions of the neighbouring points.
 *
 * @param surface - Surface of the tiles.
 * @param address - Tile of the point.
 * @param u - Tile coordinate of the point, west to east.
 * @param v - Tile coordinate of the point, north to south.
 * @param step - Distance to the neighbouring points, in tile coordinates; typically one grid cell.
 * @param height - Height in metres at tile coordinates, `NaN` where it is unknown; neighbours without a height use
 *     one-sided differences.
 * @returns The normal, or the up vector of the surface when no difference is available.
 */
export function tileSurfaceNormal(surface: ITileSurface, address: ITileAddress, u: number, v: number, step: number, height: (u: number, v: number) => number): ICartesian3 {
    const up = surface.up(address, u, v);
    const center = height(u, v);
    if (Number.isNaN(center)) return up;
    const at = (s: number, t: number): ICartesian3 | undefined => {
        const value = height(s, t);
        return Number.isNaN(value) ? undefined : surface.point(address, s, t, value);
    };
    const here = surface.point(address, u, v, center);
    const west = at(u - step, v) ?? here;
    const east = at(u + step, v) ?? here;
    const north = at(u, v - step) ?? here;
    const south = at(u, v + step) ?? here;
    const ex = east.x - west.x;
    const ey = east.y - west.y;
    const ez = east.z - west.z;
    const nx = north.x - south.x;
    const ny = north.y - south.y;
    const nz = north.z - south.z;
    const x = ey * nz - ez * ny;
    const y = ez * nx - ex * nz;
    const z = ex * ny - ey * nx;
    const length = Math.hypot(x, y, z);
    return length > 0 ? { x: x / length, y: y / length, z: z / length } : up;
}

/**
 * Radial height, over a reference surface, of the point of a relief on a ray, for a source whose heights are geodetic
 * or planetographic, along the normal of its ellipsoid. A tile service converts its samples with it.
 *
 * The geodetic position of a point of the ray gives the height of the relief there, whose radial height gives the next
 * point. The relief moves little between iterations, by `h * sin(lat_geodetic - lat_planetocentric)` at first.
 *
 * @param direction - Unit direction of the ray, in the body-fixed frame.
 * @param reference - Reference surface of the radial height.
 * @param system - Geodetic system of the source.
 * @param sample - Height of the source in metres above its ellipsoid at a geodetic latitude and longitude, in radians.
 * @param iterations - Iterations of the search. Defaults to 3.
 */
export function radialHeightOnRay(
    direction: Readonly<ICartesian3>,
    reference: ReferenceSurface,
    system: GeodeticSystem,
    sample: (latitudeRadians: number, longitudeRadians: number) => number,
    iterations = 3
): number {
    let radial = 0;
    for (let iteration = 0; iteration < iterations; iteration++) {
        const geodetic = system.ecefToGeodeticRadians(reference.point(direction, radial));
        const height = sample(geodetic.latitude, geodetic.longitude);
        radial = reference.height(system.geodeticRadiansToEcef(geodetic.latitude, geodetic.longitude, height));
    }
    return radial;
}
