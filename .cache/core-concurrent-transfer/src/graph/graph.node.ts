import type { ICartesian, ICartesian3, IHasTransform, IMatrix4, IQuaternion } from "../geometry";
import { Cartesian3, Matrix4, Quaternion } from "../geometry";
import { Nullable } from "../types";
import { GraphItem } from "./graph.graphItem";
import { Child, isChildRelation } from "./graph.olink";
import { cloneable, INode, IOlink } from "./graph.interfaces";

/** Reused pose defaults + transient scratch for the node transform compose.
 *  The frozen defaults are shared and never mutated; the translation carrier
 *  and the parent-copy scratch are working buffers, each written and consumed
 *  within a single synchronous compose (JS is single-threaded, the recursive
 *  `parent.worldTransform()` resolves before the multiply), so one shared
 *  instance is safe and avoids per-call allocation. */
const IDENTITY_QUAT: IQuaternion = Object.freeze(new Quaternion(0, 0, 0, 1));
const UNIT_SCALE: ICartesian3 = Object.freeze(new Cartesian3(1, 1, 1));
const POSE_TRANSLATION: Cartesian3 = new Cartesian3();
const POSE_SCALE: Cartesian3 = new Cartesian3(1, 1, 1);
const SCRATCH_PARENT: Matrix4 = new Matrix4();

/** Compose a fresh local matrix `T(position) · R(orientation) · S(scale)`.
 *  `position` is read through `ICartesian3` (a missing axis = 0, so a 2D
 *  quadtree position still works); `scale` likewise (a missing axis = 1, so an
 *  unset scale stays the identity). An empty pose yields identity. The 4×4
 *  arithmetic is delegated to `Matrix4` (the single source of matrix math);
 *  this only feeds it the pose with sane defaults. */
function composeLocalMatrix(position: ICartesian | undefined, orientation: IQuaternion | undefined, scale: ICartesian | undefined): Matrix4 {
    if (position === undefined && orientation === undefined && scale === undefined) {
        return new Matrix4(); // the constructor defaults to identity
    }
    const p = position as ICartesian3 | undefined;
    POSE_TRANSLATION.x = p?.x ?? 0;
    POSE_TRANSLATION.y = p?.y ?? 0;
    POSE_TRANSLATION.z = p?.z ?? 0;
    let scaleVec: ICartesian3 = UNIT_SCALE;
    if (scale !== undefined) {
        const s = scale as ICartesian3;
        POSE_SCALE.x = s.x ?? 1;
        POSE_SCALE.y = s.y ?? 1;
        POSE_SCALE.z = s.z ?? 1;
        scaleVec = POSE_SCALE;
    }
    return new Matrix4().composeInPlace(scaleVec, orientation ?? IDENTITY_QUAT, POSE_TRANSLATION);
}

/** Predicate for the `onsc` / `opsc` filter: a structural `Child` relation link
 *  (the generic parent/child hierarchy). Module-level so the closure is shared,
 *  not re-allocated per call.
 *
 *  Tests the ontology id rather than the class, because a page can hold two
 *  copies of this module and `instanceof` then fails on a link that is correct
 *  in every other respect. See `isChildRelation`. */
const isChildLink = (link: IOlink): boolean => isChildRelation(link);

export class GraphNode<B = unknown> extends GraphItem<B> implements INode<B> {
    protected _onsc: IOlink[];
    protected _opsc: IOlink[];

    // Backing fields named to avoid colliding with subclass editables that
    // already use `_position` / `_rotation` (e.g. the geometry Transform
    // node). `@cloneable` lives on the public getters below so the serialized
    // keys stay "position" / "orientation" (save-file compatible).
    private _positionValue?: ICartesian;
    private _orientationValue?: IQuaternion;
    private _scaleValue?: ICartesian;

    /** Lazy cache of the transform parent, DERIVED from the incoming `Child`
     *  relation (`opsc` filtered to `Child` -> its `oini`). Three states:
     *  `undefined` = not computed yet; `null` = computed, no parent; an `INode`
     *  = the parent. Invalidated by `add`/`remove` whenever a `Child` link on
     *  this node's `opsc` changes. The parent is a GENERIC graph relation, not a
     *  field owned by IHasTransform; the transform tree just consumes it. */
    private _parentCache?: Nullable<INode>;

    /** Cached local pose matrix; `undefined` = invalidated (recomposed on the
     *  next `localTransform()`). The cache IS the matrix-or-undefined: a pose
     *  setter nulls it directly rather than flipping a boolean. Stays
     *  undefined for a node that never asks for its transform, so a
     *  non-spatial node (most neurons) holds no 4×4. */
    private _local?: Matrix4;
    /** Cached world pose matrix; `undefined` = invalidated. Nulled (push) by a
     *  pose / parent change on THIS node or any ancestor (see
     *  `_invalidateWorldAndChildren`); recomposed on the next read. No version
     *  counter: the `child` relation lets invalidation propagate down the tree
     *  directly, so a node never has to poll a parent's version. */
    private _world?: Matrix4;

    /** The node's founding spatial coordinate (see IHasTransform.position).
     *  Reassigning it invalidates the cached local + world transforms;
     *  mutating the vector IN PLACE does not — reassign, or call
     *  `invalidateTransform()`. */
    @cloneable
    public get position(): ICartesian | undefined {
        return this._positionValue;
    }

    public set position(v: ICartesian | undefined) {
        if (v === this._positionValue) {
            return;
        }
        this._positionValue = v;
        this._local = undefined; // local pose changed -> recompose on next read
        this._invalidateWorldAndChildren(); // push: this world + every descendant's
    }

    /** The node's orientation (see IHasTransform.orientation). Reassigning it
     *  invalidates the cached local + world transforms. */
    @cloneable
    public get orientation(): IQuaternion | undefined {
        return this._orientationValue;
    }

    public set orientation(v: IQuaternion | undefined) {
        if (v === this._orientationValue) {
            return;
        }
        this._orientationValue = v;
        this._local = undefined; // local pose changed -> recompose on next read
        this._invalidateWorldAndChildren(); // push: this world + every descendant's
    }

    /** The node's non-uniform scale (see IHasTransform.scale). Completes the
     *  local pose `T·R·S`; undefined = unit scale. Reassigning it invalidates
     *  the cached local + world transforms. */
    @cloneable
    public get scale(): ICartesian | undefined {
        return this._scaleValue;
    }

    public set scale(v: ICartesian | undefined) {
        if (v === this._scaleValue) {
            return;
        }
        this._scaleValue = v;
        this._local = undefined; // local pose changed -> recompose on next read
        this._invalidateWorldAndChildren(); // push: this world + every descendant's
    }

    /** Parent frame in the transform tree (see IHasTransform), DERIVED from the
     *  generic `Child` relation: the `oini` of the incoming `Child` link on this
     *  node's `opsc`. Lazily computed + cached; the cache is invalidated when a
     *  `Child` link changes (add/remove). The transform tree is one consumer of
     *  this generic graph relation (scene-context resolution is another). */
    public get parent(): IHasTransform | undefined {
        if (this._parentCache === undefined) {
            // 1 parent: the `oini` of the first incoming `Child` link (null = none).
            this._parentCache = this.opsc<Child>(isChildLink)[0]?.oini ?? null;
        }
        return this._parentCache ?? undefined;
    }

    /** Convenience over the generic relation: removes any existing incoming
     *  `Child` link, then (re)establishes `v -> this` as a `Child` relation.
     *  `node.parent = x` stays a one-liner, but the TRUTH is the `Child` link.
     *  Relation endpoints are nodes (a transform parent is always a node), so
     *  `v` is taken as an INode. */
    public set parent(v: IHasTransform | undefined) {
        if (v === this.parent) {
            return;
        }
        if (v === undefined) {
            // Detach: drop the incoming Child relation(s). opsc(filter) returns a
            // fresh copy, so disposing (which mutates _opsc) while iterating is
            // safe; dispose unwires both ends -> remove() clears the cache.
            for (const link of this.opsc<Child>(isChildLink)) {
                link.dispose();
            }
        } else {
            // Re-parent: creating the Child link wires it via add(), which
            // enforces the single-parent invariant (drops the old incoming Child
            // first) and clears the parent cache.
            // eslint-disable-next-line no-new
            new Child(v as unknown as INode, this);
        }
    }

    /** Invalidate the derived parent cache + the world cache when a `Child`
     *  relation on this node changes. Mirrors the old direct `parent` setter:
     *  drop the cached world, force a recompose vs the (new) parent even if its
     *  version coincides, and bump the world version so children observe it. */
    private _invalidateParentRelation(): void {
        this._parentCache = undefined;
        this._invalidateWorldAndChildren(); // parent frame changed -> this world + descendants
    }

    /** Push-invalidate this node's cached world AND every descendant's, walking
     *  the `child` relation (`onsc` Child links -> their `ofin`). Replaces the
     *  old version-counter scheme: a pose / parent change nulls the world here
     *  and propagates DOWN the child tree so each descendant recomposes on its
     *  next read. The `child` relation is a single-parent forest (1 parent via
     *  `opsc`, N children via `onsc`), so the walk is acyclic and terminates. */
    protected _invalidateWorldAndChildren(): void {
        this._world = undefined;
        for (const link of this.onsc<Child>(isChildLink)) {
            if (link.ofin) {
                (link.ofin as unknown as GraphNode)._invalidateWorldAndChildren();
            }
        }
    }

    /** This node's children via the generic `Child` relation: the `ofin` of each
     *  outgoing `Child` link on `onsc` (1/N: one parent, N children). */
    public get children(): INode[] {
        const out: INode[] = [];
        for (const link of this.onsc<Child>(isChildLink)) {
            if (link.ofin) {
                out.push(link.ofin);
            }
        }
        return out;
    }

    public constructor(onsc: Nullable<IOlink[]> = null, opsc: Nullable<IOlink[]> = null, position?: ICartesian) {
        super();
        this._onsc = onsc ?? [];
        this._opsc = opsc ?? [];
        this.position = position;
        for (const link of this._onsc) {
            this.nscAdded(link);
        }
        for (const link of this._opsc) {
            this.pscAdded(link);
        }
    }

    public onsc<L extends IOlink>(filter?: (link: IOlink) => boolean): Array<L> {
        return (filter ? this._onsc.filter(filter) : this._onsc) as Array<L>;
    }

    public opsc<L extends IOlink>(filter?: (link: IOlink) => boolean): Array<L> {
        return (filter ? this._opsc.filter(filter) : this._opsc) as Array<L>;
    }

    public add<L extends IOlink>(...links: Array<L>): void {
        if (links.length === 0) {
            return;
        }
        for (const link of links) {
            if (link.oini === this) {
                const a = this._onsc;
                const i = a.indexOf(link);
                if (i >= 0) {
                    continue;
                }
                this._onsc.push(link);
                this.nscAdded(link);
            } else if (link.ofin === this) {
                const a = this._opsc;
                const i = a.indexOf(link);
                if (i >= 0) {
                    continue;
                }
                if (isChildRelation(link)) {
                    // Single-parent invariant: a node has at most ONE incoming
                    // Child link. Drop any existing parent relation before wiring
                    // the new one (dispose unwires it from both ends). The new
                    // link is not in _opsc yet, so the filter sees only the old.
                    const existings = this.opsc<Child>(isChildLink);
                    if (existings.length > 0) {
                        for (const link of existings) {
                            link.dispose();
                        }
                    } else {
                        this._invalidateParentRelation();
                    }
                }
                this._opsc.push(link);
                this.pscAdded(link);
            }
        }
    }

    public remove<L extends IOlink>(...links: Array<L>): void {
        if (links.length === 0) {
            return;
        }
        for (const link of links) {
            if (link.oini === this) {
                const a = this._onsc;
                const i = a.indexOf(link);
                if (i >= 0) {
                    a.splice(i, 1);
                    this.nscRemoved(link);
                }
            } else if (link.ofin === this) {
                const a = this._opsc;
                const i = a.indexOf(link);
                if (i >= 0) {
                    a.splice(i, 1);
                    this.pscRemoved(link);
                    if (isChildRelation(link)) {
                        this._invalidateParentRelation();
                    }
                }
            }
        }
    }

    protected nscAdded<L extends IOlink>(..._links: Array<L>): void {}
    protected nscRemoved<L extends IOlink>(..._links: Array<L>): void {}
    protected pscAdded<L extends IOlink>(..._links: Array<L>): void {}
    protected pscRemoved<L extends IOlink>(..._links: Array<L>): void {}

    // ── IHasTransform: pure-geometry pose, composed on demand ─────────
    //
    // No runtime / session / port concept here (that is the sim layer's,
    // layered on top by overriding these). World objects override
    // localTransform/worldTransform to fold in a wired `local` override
    // or a scene-parent fallback; the default below is the founding pose.

    /** Local pose as a 4×4 (see IHasTransform): composed from
     *  `position` / `orientation` / `scale`, identity when all are unset. CACHED — the
     *  matrix is held until a pose change nulls it (the setters); repeated
     *  reads return the same instance. BORROWED / read-only (see IHasTransform):
     *  callers must not mutate it. Returns the concrete `Matrix4` (the contract
     *  is the wider `IMatrix4`). */
    public localTransform(): Matrix4 {
        let local = this._local;
        if (local === undefined) {
            local = this._local = composeLocalMatrix(this._positionValue, this._orientationValue, this._scaleValue);
        }
        return local;
    }

    /** World pose as a 4×4 (see IHasTransform): `parent.worldTransform() × local`,
     *  or the local pose when there is no parent. CACHED via a null-based scheme:
     *  a pose / parent change on this node OR an ancestor push-invalidates
     *  `_world` (see `_invalidateWorldAndChildren`); the next read recomposes
     *  (a fresh buffer). BORROWED / read-only result (see IHasTransform): a root
     *  node returns its `localTransform()` instance, so mutating the result
     *  would corrupt the local. */
    public worldTransform(): Matrix4 {
        const local = this.localTransform();
        const parent = this.parent;
        if (parent === undefined) {
            return local; // root: world IS local
        }
        if (this._world === undefined) {
            this._world = this.composeWorldInto(local, parent.worldTransform(), new Matrix4());
        }
        return this._world;
    }

    /** Invalidate the cached local + world matrices (see IHasTransform). Same
     *  effect as a pose setter: the next `localTransform()` / `worldTransform()`
     *  recomposes, and the world invalidation pushes down to every descendant.
     *  The escape hatch for an in-place pose mutation (`node.position.x = ...`)
     *  the setters cannot see. */
    public invalidateTransform(): void {
        this._local = undefined;
        this._invalidateWorldAndChildren();
    }

    /** Compose `out = parentWorld · local` into the caller's `out` and return
     *  it. The parent is copied into shared scratch first so the multiply is
     *  aliasing-safe. The base path passes a fresh matrix (it recomposes only
     *  on invalidation); world-object subclasses that recompute every fire
     *  (ports / scene change) pass a REUSED `out` to avoid per-tick allocation. */
    protected composeWorldInto(local: IMatrix4, parentWorld: IMatrix4, out: Matrix4): Matrix4 {
        SCRATCH_PARENT.copyFrom(parentWorld);
        SCRATCH_PARENT.multiplyToRef(local, out);
        return out;
    }
}
