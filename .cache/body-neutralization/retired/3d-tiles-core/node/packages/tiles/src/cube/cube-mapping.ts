import type { ICartesian3 } from "@spacexr/geodesy";

import type { IGeographic2 } from "../addressing/metrics";
import { assertValidTileAddress, tileCount, type ITileAddress } from "../addressing/tile-address";
import { CUBE_FACE_FRAMES, CubeFace } from "./cube-face";

const QUARTER_TURN = Math.PI / 4;
const DEGREES = 180 / Math.PI;

/** Position on a face of the cube index: `u` and `v` in `[0, 1]`, from the north-west corner of the face. */
export interface ICubeFaceCoordinates {
    face: CubeFace;
    u: number;
    v: number;
}

function normalize(x: number, y: number, z: number, target: ICartesian3): ICartesian3 {
    const length = Math.hypot(x, y, z);
    target.x = x / length;
    target.y = y / length;
    target.z = z / length;
    return target;
}

/**
 * Direction of a point of a face, with the equi-angular mapping: `normalize(C + tan(pi/4 (2u - 1)) U + tan(pi/4
 * (2v - 1)) V)`. Coordinates outside `[0, 1]` extend the face plane, up to `-0.5` and `1.5` exclusive.
 *
 * @param face - Face of the cube index.
 * @param u - Coordinate along the face `u` axis, 0 on its west edge.
 * @param v - Coordinate along the face `v` axis, 0 on its north edge.
 * @param target - Receives the unit direction.
 */
export function cubeFaceDirection(face: CubeFace, u: number, v: number, target: ICartesian3 = { x: 0, y: 0, z: 0 }): ICartesian3 {
    const frame = CUBE_FACE_FRAMES[face];
    if (!frame) throw new RangeError(`Cube face ${face} does not exist.`);
    const a = Math.tan(QUARTER_TURN * (2 * u - 1));
    const b = Math.tan(QUARTER_TURN * (2 * v - 1));
    const { center: c, u: du, v: dv } = frame;
    return normalize(c.x + a * du.x + b * dv.x, c.y + a * du.y + b * dv.y, c.z + a * du.z + b * dv.z, target);
}

/**
 * Face of a direction: the face of its largest absolute component, its sign giving the face. Ties go to the first
 * axis in the order `X`, `Y`, `Z`, so a direction on a cube edge belongs to an equatorial face.
 *
 * @param direction - Any non-zero vector; it does not need to be normalized.
 * @throws RangeError When the direction is zero or not finite.
 */
export function cubeFaceOfDirection(direction: Readonly<ICartesian3>): CubeFace {
    const { x, y, z } = direction;
    const ax = Math.abs(x);
    const ay = Math.abs(y);
    const az = Math.abs(z);
    if (!(ax + ay + az > 0) || !Number.isFinite(ax + ay + az)) throw new RangeError("A cube direction must be finite and non-zero.");
    if (ax >= ay && ax >= az) return x > 0 ? CubeFace.PositiveX : CubeFace.NegativeX;
    if (ay >= az) return y > 0 ? CubeFace.PositiveY : CubeFace.NegativeY;
    return z > 0 ? CubeFace.North : CubeFace.South;
}

/**
 * Face and face coordinates of a direction, the inverse of {@link cubeFaceDirection}.
 *
 * @param direction - Any non-zero vector; it does not need to be normalized.
 * @throws RangeError When the direction is zero or not finite.
 */
export function cubeFaceCoordinates(direction: Readonly<ICartesian3>): ICubeFaceCoordinates {
    const face = cubeFaceOfDirection(direction);
    const { center, u, v } = CUBE_FACE_FRAMES[face]!;
    const c = direction.x * center.x + direction.y * center.y + direction.z * center.z;
    const a = (direction.x * u.x + direction.y * u.y + direction.z * u.z) / c;
    const b = (direction.x * v.x + direction.y * v.y + direction.z * v.z) / c;
    return { face, u: (Math.atan(a) / QUARTER_TURN + 1) / 2, v: (Math.atan(b) / QUARTER_TURN + 1) / 2 };
}

/**
 * Tile of a direction at a level of detail: `floor(u * 2^lod)` and `floor(v * 2^lod)` on its face, clamped so that
 * the east and south edges of the face belong to its last tiles.
 *
 * @throws RangeError When the direction is zero or not finite, or the level is invalid.
 */
export function cubeTileOfDirection(direction: Readonly<ICartesian3>, lod: number): ITileAddress {
    const { face, u, v } = cubeFaceCoordinates(direction);
    const count = tileCount(lod);
    const address = { face, lod, x: Math.min(count - 1, Math.floor(u * count)), y: Math.min(count - 1, Math.floor(v * count)) };
    assertValidTileAddress(address);
    return address;
}

/**
 * Direction of a point of a tile.
 *
 * @param address - Tile of the cube index; a missing face means face 0.
 * @param s - Coordinate in the tile, 0 on its west edge and 1 on its east edge.
 * @param t - Coordinate in the tile, 0 on its north edge and 1 on its south edge.
 * @param target - Receives the unit direction.
 * @throws RangeError When the address is invalid.
 */
export function cubeTileDirection(address: ITileAddress, s: number, t: number, target?: ICartesian3): ICartesian3 {
    assertValidTileAddress(address);
    const count = tileCount(address.lod);
    return cubeFaceDirection(address.face ?? 0, (address.x + s) / count, (address.y + t) / count, target);
}

/**
 * Unit direction of a planetocentric latitude and an east-positive longitude:
 * `(cos(lat) cos(lon), cos(lat) sin(lon), sin(lat))`.
 */
export function planetocentricDirection(latitudeDegrees: number, longitudeDegrees: number, target: ICartesian3 = { x: 0, y: 0, z: 0 }): ICartesian3 {
    const latitude = latitudeDegrees / DEGREES;
    const longitude = longitudeDegrees / DEGREES;
    const cosLatitude = Math.cos(latitude);
    target.x = cosLatitude * Math.cos(longitude);
    target.y = cosLatitude * Math.sin(longitude);
    target.z = Math.sin(latitude);
    return target;
}

/**
 * Planetocentric latitude and east-positive longitude of a direction, in degrees, longitudes in `(-180, 180]`. A
 * planetocentric latitude is not a geodetic one on a non-spherical body.
 *
 * @throws RangeError When the direction is zero or not finite.
 */
export function directionToPlanetocentric(direction: Readonly<ICartesian3>): IGeographic2 {
    const { x, y, z } = direction;
    const horizontal = Math.hypot(x, y);
    if (!(horizontal + Math.abs(z) > 0) || !Number.isFinite(horizontal + z)) throw new RangeError("A direction must be finite and non-zero.");
    const longitude = Math.atan2(y, x) * DEGREES;
    return { latitude: Math.atan2(z, horizontal) * DEGREES, longitude: longitude === -180 ? 180 : longitude };
}
