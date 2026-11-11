import type { ICartesian3 } from "@spacexr/geodesy";

/**
 * Face of the cube index of a celestial body. Equatorial faces are numbered eastward from the prime meridian; the
 * polar faces follow. See the repository document `docs/celestial-tiling.md`.
 */
export enum CubeFace {
    /** Centred on latitude 0, longitude 0, the `+X` axis. */
    PositiveX = 0,
    /** Centred on latitude 0, longitude 90 degrees east, the `+Y` axis. */
    PositiveY = 1,
    /** Centred on latitude 0, longitude 180 degrees, the `-X` axis. */
    NegativeX = 2,
    /** Centred on latitude 0, longitude 90 degrees west, the `-Y` axis. */
    NegativeY = 3,
    /** Centred on the north pole, the `+Z` axis. */
    North = 4,
    /** Centred on the south pole, the `-Z` axis. */
    South = 5,
}

/** Number of faces of the cube index. */
export const CUBE_FACE_COUNT = 6;

/** Frame of a cube face: its centre and the directions in which its `u` and `v` coordinates grow. */
export interface ICubeFaceFrame {
    readonly center: Readonly<ICartesian3>;
    readonly u: Readonly<ICartesian3>;
    readonly v: Readonly<ICartesian3>;
}

const axis = (x: number, y: number, z: number): Readonly<ICartesian3> => Object.freeze({ x, y, z });

/**
 * Frames of the six faces, indexed by {@link CubeFace}. On equatorial faces `u` grows eastward and `v` southward; the
 * polar faces continue face 0 without rotation. On every face `u x v = -center`: seen from outside the body, `u` runs
 * to the right and `v` downward, like the columns and rows of an image.
 */
export const CUBE_FACE_FRAMES: readonly ICubeFaceFrame[] = Object.freeze([
    { center: axis(1, 0, 0), u: axis(0, 1, 0), v: axis(0, 0, -1) },
    { center: axis(0, 1, 0), u: axis(-1, 0, 0), v: axis(0, 0, -1) },
    { center: axis(-1, 0, 0), u: axis(0, -1, 0), v: axis(0, 0, -1) },
    { center: axis(0, -1, 0), u: axis(1, 0, 0), v: axis(0, 0, -1) },
    { center: axis(0, 0, 1), u: axis(0, 1, 0), v: axis(1, 0, 0) },
    { center: axis(0, 0, -1), u: axis(0, 1, 0), v: axis(-1, 0, 0) },
]);

/** Returns `true` for an integer face of the cube index. */
export function isCubeFace(face: number): face is CubeFace {
    return Number.isInteger(face) && face >= 0 && face < CUBE_FACE_COUNT;
}
