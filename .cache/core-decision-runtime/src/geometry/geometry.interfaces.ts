export interface ICartesian {
    /** Euclidean distance to another point. */
    distance(b: ICartesian): number;
    /** Squared euclidean distance (avoids sqrt). Preferred for comparison-only use cases. */
    distanceSquared(b: ICartesian): number;
    subtract(b: ICartesian): this;
    add(b: ICartesian): this;
    addInPlace(b: ICartesian): this;
    multiplyByScalar(n: number): this;
    divideByScalar(n: number): this;
    magnitude(): number;
    toString(): string;
    clone(): this;
}

export interface ICartesian2 extends ICartesian {
    x: number;
    y: number;
}

export interface ICartesian3 extends ICartesian2 {
    z: number;
}

export interface ICartesian4 extends ICartesian3 {
    w: number;
}

/**
 * Type guard for ICartesian (ICartesian2 | ICartesian3 | ICartesian4)
 */
export function isCartesian(obj: unknown): obj is ICartesian {
    return isCartesian2(obj) || isCartesian3(obj) || isCartesian4(obj);
}

/**
 * Type guard for ICartesian2
 */
export function isCartesian2(b: unknown): b is ICartesian2 | ICartesian3 | ICartesian4 {
    if (typeof b !== "object" || b === null) return false;
    return "x" in b && "y" in b;
}

/**
 * Type guard for ICartesian3
 */
export function isCartesian3(b: unknown): b is ICartesian3 | ICartesian4 {
    if (!isCartesian2(b)) return false;
    return "z" in b;
}

/**
 * Type guard for ICartesian4
 */
export function isCartesian4(b: unknown): b is ICartesian4 {
    if (!isCartesian3(b)) return false;
    return "w" in b;
}

export interface IQuaternion {
    x: number;
    y: number;
    z: number;
    w: number;
}

/**
 * 4×4 homogeneous transform matrix. Backed by a flat 16-entry buffer
 * in COLUMN-MAJOR layout, matching the convention used by every major
 * 3D engine bridge (UE5 `FMatrix`, Babylon.js `Matrix.m`, three.js
 * `Matrix4.elements`, WebGL / glsl `mat4`). This ordering lets us
 * upload the buffer to a GPU shader uniform with zero transposition.
 *
 * Index layout (`m[col*4 + row]`):
 *
 *       col 0   col 1   col 2   col 3
 *   ─────────────────────────────────────────
 *   m[0]    m[4]    m[8]     m[12]   ← row 0
 *   m[1]    m[5]    m[9]     m[13]   ← row 1
 *   m[2]    m[6]    m[10]    m[14]   ← row 2
 *   m[3]    m[7]    m[11]    m[15]   ← row 3
 *
 * Translation lives in `m[12..14]`, the upper-left 3×3 carries
 * rotation × non-uniform scale, and the bottom row is `[0, 0, 0, 1]`
 * for affine transforms.
 *
 * The interface is intentionally narrow (just the buffer) so a plain
 * `Float64Array` of length 16 satisfies it structurally — useful for
 * the SceneStateView, which may return a matrix that lives in a
 * scratch buffer the consumer is expected to read-and-discard rather
 * than hold onto.
 */
export interface IMatrix4 {
    /** Column-major 4×4 entries, length 16. */
    readonly m: ArrayLike<number>;
}

/**
 * The flat, serialized form of a 4×4 matrix: a plain column-major
 * `number[16]` (translation in [12..14], homogeneous row at
 * [3],[7],[11],[15]). Same layout as `Matrix4.m`.
 *
 * This is the WIRE form carried on `matrix44` ports and the storage
 * form of `@cloneable` transform fields: a plain array round-trips
 * through JSON save/load and crosses plugin boundaries without coupling
 * consumers to the `Matrix4` class. `Matrix4` owns the MATH (compose /
 * multiply / decompose); `Matrix44` is its serialized projection, with
 * `Matrix4.fromFlat()` / `Matrix4.prototype.toFlat()` as the single
 * bridge. The two are one abstraction with two faces, not two classes.
 */
export type Matrix44 = ReadonlyArray<number>;

/**
 * A thing that carries a geometric pose and reports its local and world
 * 4×4 transforms. This is the founding spatial contract of a node: its
 * `position` (the quadtree / octree coordinate that influences weights
 * and synapses by proximity) plus an optional `orientation`, composed
 * on demand into a local matrix, chained through a `parent` to yield the
 * world matrix `parent.worldTransform() × localTransform()`.
 *
 * Pure geometry: no runtime, session, port, or `fire` concept appears
 * here. Every data member is optional, so a non-spatial node (most
 * neurons) carries nothing and pays nothing; the matrices are cached on
 * the node and produced lazily, only when `localTransform()` /
 * `worldTransform()` are actually called. A port-fed `local` override or a
 * scene-parent fallback is the SIM layer's concern, layered on top by
 * overriding these methods — it never leaks into this contract.
 *
 * READ-ONLY RETURN CONTRACT: `localTransform()` / `worldTransform()` return
 * BORROWED, reused buffers, valid only until this node's next transform
 * call (the implementation reuses them to stay allocation-free). Callers
 * MUST NOT mutate the result; copy it (`toFlat` / `copyFrom`) to retain or
 * modify. In particular a root node's `worldTransform()` may return the very
 * SAME instance as its `localTransform()`, so mutating one would corrupt the
 * other.
 *
 * Cache invalidation is PUSH-based: a pose change (or a parent/child relation
 * change) nulls this node's cached world AND, walking the `child` relations,
 * the cached world of every descendant, so each recomposes on its next read.
 * There is no version counter; the cache is simply the matrix-or-undefined.
 */
export interface IHasTransform {
    /** The founding spatial coordinate of the node: indexed in the
     *  quadtree / octree, influences weights / synapses by proximity. 2D
     *  or 3D (`ICartesian`); a missing `z` (a 2D position) is taken as 0
     *  by transform composition. Distinct from the editor canvas x,y,
     *  which lives in the view layer (NodeUI), not here. */
    position?: ICartesian;
    /** Orientation completing the local pose alongside `position`. Named
     *  `orientation` (not `rotation`) to avoid clashing with domain nodes
     *  that already expose a computed `rotation` accessor (Attitude,
     *  Transform). Optional: undefined = identity. */
    orientation?: IQuaternion;
    /** Non-uniform scale completing the local pose `T(position)·R(orientation)·S(scale)`.
     *  Optional: undefined = unit scale; a missing axis is taken as 1 (mirror
     *  of how a missing `position` axis is taken as 0). Carried on the founding
     *  contract so the full affine pose is expressible without a parallel
     *  transform type. */
    scale?: ICartesian;
    /** Parent frame in the transform tree; `worldTransform()` chains
     *  through it. Undefined = this node's world equals its local. A
     *  structural reference, established by the enclosing container, not
     *  part of the node's serialized identity. */
    parent?: IHasTransform;
    /** This node's local pose as a column-major 4×4, composed on demand
     *  from `position` / `orientation` / `scale` (identity when all are unset). */
    localTransform(): IMatrix4;
    /** This node's world pose as a column-major 4×4:
     *  `parent ? parent.worldTransform() × localTransform() : localTransform()`. */
    worldTransform(): IMatrix4;
    /** Force the cached local + world matrices to recompose on the next
     *  `localTransform()` / `worldTransform()`, AND push-invalidate every
     *  descendant's cached world (down the `child` relations). The pose setters
     *  (`position` / `orientation` / `scale`) invalidate automatically; call
     *  this explicitly after mutating a pose value IN PLACE
     *  (`node.position.x = ...`), which the setters cannot observe. */
    invalidateTransform(): void;
}
