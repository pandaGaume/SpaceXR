export type BoxType = [number, number, number, number, number, number, number, number, number, number, number, number];
export type RegionType = [number, number, number, number, number, number];
export type SphereType = [number, number, number, number];

/**
 * A bounding volume that encloses a tile or its content. At least one bounding volume property is required. Bounding volumes include `box`, `region`, or `sphere`.
 */
export interface IBoundingVolume {
    /**
     * An array of 12 numbers that define an oriented bounding box.
     * The first three elements define the x, y, and z values for the center of the box.
     * The next three elements (with indices 3, 4, and 5) define the x axis direction and half-length.
     * The next three elements (indices 6, 7, and 8) define the y axis direction and half-length.
     * The last three elements (indices 9, 10, and 11) define the z axis direction and half-length.
     *
     * @minItems 12
     * @maxItems 12
     */
    box?: BoxType;
    /**
     * An array of six numbers that define a bounding geographic region in EPSG:4979 coordinates
     * with the order [west, south, east, north, minimum height, maximum height].
     * Longitudes and latitudes are in radians. The range for latitudes is [-PI/2,PI/2].
     * The range for longitudes is [-PI,PI]. The value that is given as the 'south' of the region shall not be larger than the value for the 'north' of the region. The heights are in meters above (or below) the WGS84 ellipsoid. The 'minimum height' shall not be larger than the 'maximum height'.
     *
     * @minItems 6
     * @maxItems 6
     */
    region?: RegionType;
    /**
     * An array of four numbers that define a bounding sphere. The first three elements define the x, y, and z values for the center of the sphere. The last element (with index 3) defines the radius in meters. The radius shall not be negative.
     *
     * @minItems 4
     * @maxItems 4
     */
    sphere?: SphereType;
}

export function AreBoxIntersect(a: BoxType, b: BoxType): boolean {
    for (let i = 0; i < 3; ++i) {
        const ai = 3 + i * 3;
        const aj = ai + 1;
        const ak = ai + 2;

        const aHalf = Math.sqrt(a[ai] ** 2 + a[aj] ** 2 + a[ak] ** 2);
        const bHalf = Math.sqrt(b[ai] ** 2 + b[aj] ** 2 + b[ak] ** 2);

        const aMin = a[i] - aHalf;
        const aMax = a[i] + aHalf;

        const bMin = b[i] - bHalf;
        const bMax = b[i] + bHalf;

        // Sort early if separated on this axis
        if (aMax < bMin || aMin > bMax) {
            return false;
        }
    }

    return true;
}

/**
 * Create a tight bounding sphere from a 3D Tiles oriented box.
 * Works in any coordinate system (ECEF, local, Babylon LH…) as long as
 * the box and desired sphere are in the same space.
 */
export function CreateTileSphereFromBox(box: BoxType): SphereType {
    if (!box || box.length !== 12) {
        throw new Error("ITileBox must be number[12]: [C(3), U(3), V(3), W(3)].");
    }

    const Cx = box[0],
        Cy = box[1],
        Cz = box[2];
    const Ux = box[3],
        Uy = box[4],
        Uz = box[5];
    const Vx = box[6],
        Vy = box[7],
        Vz = box[8];
    const Wx = box[9],
        Wy = box[10],
        Wz = box[11];

    // Corner offsets relative to C: ±U ±V ±W
    const offsets: Array<[number, number, number]> = [
        [-Ux - Vx - Wx, -Uy - Vy - Wy, -Uz - Vz - Wz],
        [Ux - Vx - Wx, Uy - Vy - Wy, Uz - Vz - Wz],
        [-Ux + Vx - Wx, -Uy + Vy - Wy, -Uz + Vz - Wz],
        [Ux + Vx - Wx, Uy + Vy - Wy, Uz + Vz - Wz],
        [-Ux - Vx + Wx, -Uy - Vy + Wy, -Uz - Vz + Wz],
        [Ux - Vx + Wx, Uy - Vy + Wy, Uz - Vz + Wz],
        [-Ux + Vx + Wx, -Uy + Vy + Wy, -Uz + Vz + Wz],
        [Ux + Vx + Wx, Uy + Vy + Wy, Uz + Vz + Wz],
    ];

    // Max distance from center among the 8 corners
    let maxRSq = 0;
    for (const [dx, dy, dz] of offsets) {
        const r2 = dx * dx + dy * dy + dz * dz;
        if (r2 > maxRSq) maxRSq = r2;
    }

    return [Cx, Cy, Cz, Math.sqrt(maxRSq)];
}
