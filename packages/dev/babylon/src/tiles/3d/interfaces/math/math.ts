import { ICartesian3, IPlane } from "core/geometry";
import { BoxType, SphereType } from "../boundingVolume";

export type Mat44Type =
    | [number, number, number, number, number, number, number, number, number, number, number, number, number, number, number, number]
    | Float32Array
    | Float64Array;

// Column-major identity
export const IDENTITY44: Mat44Type = new Float64Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);

// A for (xb, yb, zb) = (-x, +z, -y)
export const A: Mat44Type = new Float64Array([-1, 0, 0, 0, 0, 0, -1, 0, 0, 1, 0, 0, 0, 0, 0, 1]);
export const Ainv: Mat44Type = new Float64Array([-1, 0, 0, 0, 0, 0, 1, 0, 0, -1, 0, 0, 0, 0, 0, 1]);

/// <summary>
/// Why `M_bjs = A * M_ecef * A^{-1}` ?  (change of basis)
///
/// We have two coordinate systems:
///   - ECEF (right-handed), where tiles/boxes/transforms are defined
///   - Babylon (left-handed, Y up), where we render
///
/// Let A be the fixed 4×4 matrix that converts a vector from ECEF to Babylon:
///     p_bjs = A * p_ecef
/// Then its inverse converts back:
///     p_ecef = A^{-1} * p_bjs
///
/// If a child point transforms in ECEF as:
///     p_parent_ecef = M_ecef * p_child_ecef
/// substitute p_ecef = A^{-1} * p_bjs:
///     p_parent_bjs = A * p_parent_ecef
///                   = A * M_ecef * p_child_ecef
///                   = A * M_ecef * (A^{-1} * p_child_bjs)
///                   = (A * M_ecef * A^{-1}) * p_child_bjs
///
/// Therefore the same hierarchical relation holds in Babylon with:
///     M_bjs = A * M_ecef * A^{-1}
///
/// Reading order (column-vector convention): right → left.
/// So when applied to a point, A^{-1} acts first (go to ECEF),
/// then M_ecef, then A (return to Babylon).
///
/// With your axis mapping (xb, yb, zb) = (-x, +z, -y), the matrices are:
///   A =
///     [ -1  0  0  0
///       0   0  1  0
///       0  -1  0  0
///       0   0  0  1 ]
///   A^{-1} = Aᵀ =
///     [ -1  0   0  0
///       0   0  -1  0
///       0   1   0  0
///       0   0   0  1 ]
///
/// Practical split for affine M = [R t; 0 1]:
///   R_bjs = A * R_ecef * A^{-1}
///   t_bjs = A * t_ecef      // just transform the translation as a vector
///
/// Sanity checks:
///   - Pure translation t maps to the same component-wise mapping as points.
///   - Rotation about ECEF-Z becomes rotation about Babylon-Y (since z→y).
/// </summary>
export function EcefMatToBjsToRef(M_ecef: Mat44Type, ref: Mat44Type): void {
    const tmp = new Float32Array(16);
    Mat44MultToRef(A, M_ecef, tmp); // t = A * M
    Mat44MultToRef(tmp, Ainv, ref); // M_bjs = t * Ainv
}

/// <summary>
/// Column-major 4x4 multiply: ref = a * b
/// Safe if ref === a or ref === b.
/// </summary>
export function Mat44MultToRef(a: Mat44Type, b: Mat44Type, ref: Mat44Type): void {
    // cache inputs (handles aliasing)
    const a00 = a[0],
        a01 = a[1],
        a02 = a[2],
        a03 = a[3];
    const a10 = a[4],
        a11 = a[5],
        a12 = a[6],
        a13 = a[7];
    const a20 = a[8],
        a21 = a[9],
        a22 = a[10],
        a23 = a[11];
    const a30 = a[12],
        a31 = a[13],
        a32 = a[14],
        a33 = a[15];

    const b00 = b[0],
        b01 = b[1],
        b02 = b[2],
        b03 = b[3];
    const b10 = b[4],
        b11 = b[5],
        b12 = b[6],
        b13 = b[7];
    const b20 = b[8],
        b21 = b[9],
        b22 = b[10],
        b23 = b[11];
    const b30 = b[12],
        b31 = b[13],
        b32 = b[14],
        b33 = b[15];

    // column 0
    ref[0] = a00 * b00 + a10 * b01 + a20 * b02 + a30 * b03;
    ref[1] = a01 * b00 + a11 * b01 + a21 * b02 + a31 * b03;
    ref[2] = a02 * b00 + a12 * b01 + a22 * b02 + a32 * b03;
    ref[3] = a03 * b00 + a13 * b01 + a23 * b02 + a33 * b03;

    // column 1
    ref[4] = a00 * b10 + a10 * b11 + a20 * b12 + a30 * b13;
    ref[5] = a01 * b10 + a11 * b11 + a21 * b12 + a31 * b13;
    ref[6] = a02 * b10 + a12 * b11 + a22 * b12 + a32 * b13;
    ref[7] = a03 * b10 + a13 * b11 + a23 * b12 + a33 * b13;

    // column 2
    ref[8] = a00 * b20 + a10 * b21 + a20 * b22 + a30 * b23;
    ref[9] = a01 * b20 + a11 * b21 + a21 * b22 + a31 * b23;
    ref[10] = a02 * b20 + a12 * b21 + a22 * b22 + a32 * b23;
    ref[11] = a03 * b20 + a13 * b21 + a23 * b22 + a33 * b23;

    // column 3 (translation column)
    ref[12] = a00 * b30 + a10 * b31 + a20 * b32 + a30 * b33;
    ref[13] = a01 * b30 + a11 * b31 + a21 * b32 + a31 * b33;
    ref[14] = a02 * b30 + a12 * b31 + a22 * b32 + a32 * b33;
    ref[15] = a03 * b30 + a13 * b31 + a23 * b32 + a33 * b33;
}

/**
 * Computes the dot product between a vector `n`
 * and a 3D point/vector stored in a flat array starting at `offset`.
 *
 * @param n           3D vector
 * @param coordinates Flat array containing the point/vector components
 * @param offset      Index of the x-component in the array
 * @returns           Dot product result
 */
export function Dot3(n: ICartesian3, coordinates: number[], offset: number): number {
    return n.x * coordinates[offset] + n.y * coordinates[offset + 1] + n.z * coordinates[offset + 2];
}

/**
 * Computes the signed distance from a 3D point to a plane.
 *
 * Plane equation convention: dot(normal, x) + d = 0
 *
 * @param p           Plane (normal vector + constant d)
 * @param coordinates Flat array containing the point coordinates
 * @param offset      Index of the x-component in the array
 * @returns           Signed distance (positive = in front of plane, negative = behind)
 */
export function DistanceFromPlane(p: IPlane, coordinates: number[], offset: number): number {
    return Dot3(p.normal, coordinates, offset) + p.d;
}

/**
 * Computes the Euclidean distance between a point (ICartesian3)
 * and another point stored in a flat number array with offset.
 *
 * @param pointA   First point as ICartesian3
 * @param pointB   Array containing the second point
 * @param offset   Start index of the second point (x at offset, y at offset+1, z at offset+2)
 * @returns        Euclidean distance between the two points
 */
export function Distance(pointA: ICartesian3, pointB: number[], offset: number): number {
    const dx = pointA.x - pointB[offset++];
    const dy = pointA.y - pointB[offset++];
    const dz = pointA.z - pointB[offset];
    return Math.hypot(dx, dy, dz);
}

/** Transforms a point by a column-major 4x4 affine matrix (includes translation). */
export function TransformPointToRef(transform: Mat44Type, v: number[] | Float32Array, offset: number, ref: number[], refOffset: number): void {
    const a = v[offset++];
    const b = v[offset++];
    const c = v[offset];

    ref[refOffset++] = transform[0] * a + transform[4] * b + transform[8] * c + transform[12];
    ref[refOffset++] = transform[1] * a + transform[5] * b + transform[9] * c + transform[13];
    ref[refOffset] = transform[2] * a + transform[6] * b + transform[10] * c + transform[14];
}

/** Transforms a direction/half-axis by the linear (3x3) part only (no translation). */
export function TransformVectorToRef(m: Mat44Type, v: number[] | Float32Array, offset: number, ref: number[] | Float32Array, refOffset: number): void {
    const a = v[offset++];
    const b = v[offset++];
    const c = v[offset];

    ref[refOffset++] = m[0] * a + m[4] * b + m[8] * c;
    ref[refOffset++] = m[1] * a + m[5] * b + m[9] * c;
    ref[refOffset] = m[2] * a + m[6] * b + m[10] * c;
}

/**
 * Transforms a 3D Tiles box (center + 3 half-axis vectors) by a world matrix.
 * Uses your in-place helpers to avoid temporary object allocations.
 *
 * @param box  [cx,cy,cz, ex.x,ex.y,ex.z, ey.x,ey.y,ey.z, ez.x,ez.y,ez.z]
 * @param m    Column-major 4x4 affine transform
 * @param out  Destination array of length >= 12
 */
export function TransformBoxToRef(box: BoxType, m: Mat44Type, out: BoxType): void {
    // center (uses full affine: rotate/scale + translate)
    TransformPointToRef(m, box, 0, out, 0);

    // half-axes (use only linear part: rotate/scale/shear, no translation)
    TransformVectorToRef(m, box, 3, out, 3);
    TransformVectorToRef(m, box, 6, out, 6);
    TransformVectorToRef(m, box, 9, out, 9);
}

/**
 * Transforms a sphere by a world matrix.
 * Center uses full affine transform; radius scales by the max column length
 * of the 3x3 linear part (conservative under non-uniform scale/shear).
 *
 * @param sphere [cx,cy,cz,r]
 * @param m      Column-major 4x4 affine transform
 * @param out    Destination array length >= 4
 */
export function TransformSphereToRef(sphere: SphereType, m: Mat44Type, out: SphereType): void {
    // Transform center (includes translation)
    TransformPointToRef(m, sphere, 0, out, 0);

    // Compute conservative scale factor = max column length of the upper-left 3x3
    const c0x = m[0],
        c0y = m[1],
        c0z = m[2];
    const c1x = m[4],
        c1y = m[5],
        c1z = m[6];
    const c2x = m[8],
        c2y = m[9],
        c2z = m[10];

    const s0 = Math.hypot(c0x, c0y, c0z);
    const s1 = Math.hypot(c1x, c1y, c1z);
    const s2 = Math.hypot(c2x, c2y, c2z);

    const sMax = Math.max(s0, s1, s2);

    // Scale radius
    out[3] = (sphere[3] as number) * sMax;
}

/**
 * Frustum test for a 3D Tiles box using SAT-style projection.
 * Works directly on the 12-number `box` array without creating temporaries.
 *
 * @param box      [cx,cy,cz, ex.x,ex.y,ex.z, ey.x,ey.y,ey.z, ez.x,ez.y,ez.z]
 * @param frustum  Array of planes with convention: inside ⇔ dot(n, x) + d >= 0
 */
export function IsBoxInFrustum(box: BoxType, frustum: IPlane[]): boolean {
    // Offsets in the 12-tuple
    const CENTER = 0,
        EX = 3,
        EY = 6,
        EZ = 9;

    for (const pl of frustum) {
        // Project OBB half-axes onto plane normal to get projected radius
        const r = Math.abs(Dot3(pl.normal, box, EX)) + Math.abs(Dot3(pl.normal, box, EY)) + Math.abs(Dot3(pl.normal, box, EZ));

        // Signed distance of box center to plane
        const s = DistanceFromPlane(pl, box, CENTER);

        // If the center is farther behind the plane than its projected radius,
        // the box is entirely outside this plane -> outside the frustum
        if (s < -r) return false;
    }
    return true;
}

/**
 * Tests whether a sphere is inside (or intersects) a frustum.
 *
 * @param sphere [cx,cy,cz,r]
 * @param frustum Array of planes with convention: inside ⇔ dot(n, x) + d >= 0
 */
export function IsSphereInFrustum(sphere: SphereType, frustum: IPlane[]): boolean {
    const CENTER = 0; // offset for sphere center (x,y,z)
    const r = sphere[3];

    for (const pl of frustum) {
        const s = DistanceFromPlane(pl, sphere, CENTER);

        // If the sphere center is farther behind the plane than its radius,
        // the sphere is completely outside this plane → outside frustum
        if (s < -r) return false;
    }
    return true;
}

/**
 * Tests whether a point lies inside or on the surface of a sphere.
 *
 * @param sphere [cx, cy, cz, r] — center coordinates and radius
 * @param point  Point to test
 * @returns      True if the point is inside or on the sphere, false otherwise
 */
export function IsPointInSphere(sphere: SphereType, point: ICartesian3): boolean {
    const dx = point.x - sphere[0];
    const dy = point.y - sphere[1];
    const dz = point.z - sphere[2];
    const r = sphere[3];
    return dx * dx + dy * dy + dz * dz <= r * r;
}

/**
 * Tests whether a point lies inside or on the surface of a 3D Tiles box.
 *
 * A 3D Tiles box is defined as:
 *   [ cx, cy, cz,
 *     ex.x, ex.y, ex.z,
 *     ey.x, ey.y, ey.z,
 *     ez.x, ez.y, ez.z ]
 * where (cx,cy,cz) is the center and ex/ey/ez are the half-axis vectors.
 *
 * @param box   12-tuple describing the oriented bounding box
 * @param point Point to test
 * @returns     True if the point is inside or on the box, false otherwise
 */
export function IsPointInBox(box: BoxType, point: ICartesian3): boolean {
    const cx = box[0],
        cy = box[1],
        cz = box[2];
    const exx = box[3],
        exy = box[4],
        exz = box[5];
    const eyx = box[6],
        eyy = box[7],
        eyz = box[8];
    const ezx = box[9],
        ezy = box[10],
        ezz = box[11];

    // Vector from box center to point
    const dx = point.x - cx;
    const dy = point.y - cy;
    const dz = point.z - cz;

    // Project onto each half-axis and check extent
    const projX = dx * exx + dy * exy + dz * exz;
    const projY = dx * eyx + dy * eyy + dz * eyz;
    const projZ = dx * ezx + dy * ezy + dz * ezz;

    const lenX2 = exx * exx + exy * exy + exz * exz;
    const lenY2 = eyx * eyx + eyy * eyy + eyz * eyz;
    const lenZ2 = ezx * ezx + ezy * ezy + ezz * ezz;

    // Inside if absolute projection ≤ squared length of each half-axis
    return projX * projX <= lenX2 && projY * projY <= lenY2 && projZ * projZ <= lenZ2;
}

/// <summary>
/// In-place ECEF → Babylon (LH, Y up) for a single vec3 stored in a strided array.
/// Mapping: (xb, yb, zb) = (-x, +z, -y)
/// </summary>
export function EcefToBjsInPlace(v: number[] | Float32Array, offset = 0, stride = 1): void {
    // x' = -x
    v[offset] = -v[offset];

    // swap/sign for y' and z'  (y' =  z,  z' = -y)
    const yIdx = offset + stride;
    const zIdx = yIdx + stride;

    const y = v[yIdx];
    v[yIdx] = v[zIdx];
    v[zIdx] = -y;
}

/// <summary>
/// Non-in-place version returning a tuple [x', y', z'].
/// </summary>
export function EcefToBjs(x: number, y: number, z: number): [number, number, number] {
    // (-x, +z, -y)
    return [-x, z, -y];
}

/// <summary>
/// In-place transform of N consecutive vec3 in a buffer (with stride).
/// If count is omitted, it is inferred from length.
/// </summary>
export function EcefToBjsBufferInPlace(data: number[] | Float32Array, startOffset = 0, stride = 1, count?: number): void {
    const step = 3 * stride;
    const maxCount = Math.floor((data.length - startOffset) / step);
    const n = Math.min(count ?? maxCount, maxCount);
    let off = startOffset;
    for (let i = 0; i < n; i++, off += step) {
        EcefToBjsInPlace(data, off, stride);
    }
}

/// <summary>
/// 3D Tiles boundingVolume.box (12 numbers) ECEF → Babylon (LH, Y up).
/// Applies the same mapping to center and the 3 half-axes.
/// Orientation fix is intentionally omitted (not needed for your frustum checks).
/// </summary>
export function EcefBoxToBjsInPlace(box: number[] | Float32Array): void {
    // box = [ Cx,Cy,Cz,  Ux,Uy,Uz,  Vx,Vy,Vz,  Wx,Wy,Wz ]
    // convert each triplet in place
    EcefToBjsInPlace(box, 0, 1); // C
    EcefToBjsInPlace(box, 3, 1); // U
    EcefToBjsInPlace(box, 6, 1); // V
    EcefToBjsInPlace(box, 9, 1); // W
}

/// <summary>
/// In-place ECEF → Babylon (LH, Y up) for a 3D Tiles sphere [cx,cy,cz,r].
/// Mapping: (xb, yb, zb) = (-x, +z, -y). Radius unchanged.
/// </summary>
export function EcefSphereToBjsInPlace(v: number[] | Float32Array): void {
    EcefToBjsInPlace(v);
}
