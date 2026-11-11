import { cloneable, IOlink } from "../graph/graph.interfaces";
import { IDeclaresPorts, IPortDescriptor, ISession } from "../execution/execution.interfaces";
import { RuntimeNode } from "../execution/execution.node";
import { buildDefaultStateView } from "./scene-state-view.impl";
import { IDENTITY44, isMatrix44, Matrix4 } from "../geometry/geometry.matrix";
import { Cartesian3 } from "../geometry/geometry.cartesian";
import type { ICartesian, ICartesian3, IMatrix4 } from "../geometry/geometry.interfaces";
import type { Nullable } from "../types";
import type { SceneStateView } from "./scene-state-view.interface";
import type { ILiveInScene } from "./sim.interfaces";

/**
 * Base class for every runtime object that lives in a world reference
 * frame. Computes the node's world transform by composing a parent's
 * world transform with the local one:
 *
 *     world = parentWorld × local
 *
 * Inputs (both optional, default = identity):
 *   local         this object's pose in the parent's frame [matrix44]
 *   parentWorld  the parent's world transform              [matrix44]
 *
 * Output:
 *   world         this object's pose in the world frame    [matrix44]
 *
 * Environmental context (gravity, ambient temperature, pressure,
 * timeScale, atmosphere) lives on `session.sceneStateView` (a live
 * binding established at session bind by the enclosing Sim.Graph or by
 * the GraphRunner). Subclasses read it through `getScene()`, which falls
 * back to a sane Earth-surface default when no scene has been bound.
 *
 * Parent-frame inheritance: the enclosing scene IS the structural
 * `parent` of every world object, wired at session bind (the node
 * implements `ILiveInScene`). So `worldTransform()` chains object ->
 * scene -> ... -> root through the single `parent.worldTransform()`
 * mechanism, with NO separate scene-view transform. A wired
 * `parentWorld` port is an explicit override that wins over the
 * structural parent. A root scene's world is identity unless given a
 * pose, so graphs that never pose a scene see an identity parent.
 *
 * This is a CORE primitive (it was previously vendored inside the physics
 * plugin): any plugin's world object (motor, sensor, mechanical body,
 * robot link) extends it to inherit the local / parentWorld ports and a
 * `super.fire()` it calls before its own physics. The matrix is a flat
 * array of 16 numbers in column-major layout.
 */
export class TransformNode extends RuntimeNode implements IDeclaresPorts, ILiveInScene {
    /** ILiveInScene brand: every world object lives in a scene. Its transform
     *  `parent` is wired to the enclosing scene node at session bind, so
     *  `worldTransform()` chains object -> scene -> ... -> root (single truth). */
    public readonly livesInScene = true as const;

    /** Slot names exposed as static so subclasses can reference them. */
    public static readonly INPUT_LOCAL = "local";
    public static readonly INPUT_PARENT_WORLD = "parentWorld";
    public static readonly OUTPUT_WORLD = "world";

    /** Reusable port descriptor blocks so subclasses can spread them. */
    public static readonly TRANSFORM_INPUT_PORTS: ReadonlyArray<IPortDescriptor> = [
        { slot: TransformNode.INPUT_LOCAL, optional: true, type: "matrix44" },
        { slot: TransformNode.INPUT_PARENT_WORLD, optional: true, type: "matrix44" },
    ];
    public static readonly TRANSFORM_OUTPUT_PORTS: ReadonlyArray<IPortDescriptor> = [{ slot: TransformNode.OUTPUT_WORLD, optional: false, type: "matrix44" }];

    /**
     * Returns true if `slot` is one of the transform-owned input slots.
     * Subclasses use this in their fire() consume loop to skip slots
     * already consumed by `super.fire()`.
     */
    protected static isTransformInputSlot(slot: string): boolean {
        return slot === TransformNode.INPUT_LOCAL || slot === TransformNode.INPUT_PARENT_WORLD;
    }

    // ── World-pose composition (via the node's own IHasTransform) ─────
    //
    // The MATH lives once in the base `GraphNode` (position/orientation →
    // local → parent × local, via `composeWorldInto`). This node only layers
    // the SIM concerns the base must not know about: the wired `local` /
    // `parentWorld` port OVERRIDES and the enclosing scene as the default
    // parent frame. They are captured each `fire()` as fields so the pull
    // methods (`localTransform` / `worldTransform`, overridden below) report
    // the SAME pose the `world` port publishes. The world is recomposed every
    // fire (ports/scene change), so it goes into a REUSED buffer rather than
    // the base's null-invalidated cache.

    /** Wired `local` port override (reused buffer); `_localOverrideActive`
     *  gates whether it wins over the node's (position, orientation) pose. */
    private _localOverride?: Matrix4;
    private _localOverrideActive: boolean = false;

    /** Wired `parentWorld` port override (reused buffer); when active it
     *  wins over the structural `parent` and the scene. */
    private _parentWorldOverride?: Matrix4;
    private _parentWorldActive: boolean = false;

    /** Reused world buffer for the per-fire `parentWorld × local` compose
     *  (lazily allocated), so the runtime push path allocates no 4×4 per tick. */
    private _worldMatrix?: Matrix4;

    /** Composed world in flat (`Matrix44`) form, the value published on the
     *  `world` port and read by the gravity projection. A fresh array is
     *  allocated only when the world changes (consumers may hold the
     *  reference); unchanged ticks republish the same array. */
    private _worldFlat: number[] = (IDENTITY44 as number[]).slice();

    /** World's inverse rotation, reused to express world-frame gravity in the
     *  body frame (loaded from `_worldFlat` on demand). The world is a rigid
     *  body->world transform, so its inverse rotation is its transpose; that
     *  rigid-body equivalence is a DOMAIN choice made here. */
    private readonly _m4WorldRotInv: Matrix4 = new Matrix4();

    /** Per-process fallback scene view used when the bound session has
     *  no `sceneStateView`. Constructed lazily on first `getScene()`. */
    private _fallbackSceneView: SceneStateView | null = null;

    /** Optional per-node SceneItem binding (the `scene` config-link
     *  target). When the editor wires a SceneItem's `scene_out` to this
     *  node's `scene` port, the session-builder records the SceneItem's
     *  id here and injects the resolved live view via `setBoundSceneView`.
     *  Lets two motors on the same canvas live in DIFFERENT scenes
     *  (Earth vs Moon side by side) without wrapping each in a Sim.Graph.
     *  Empty string = no per-node binding (use the session scene). */
    @cloneable public sceneItemId: string = "";

    /** Editor-injected live view for `sceneItemId` (null when unbound).
     *  Runtime metadata, not @cloneable: re-resolved each session build. */
    private _boundSceneView: SceneStateView | null = null;

    /** Inject (or clear) the per-node scene view. Called by the editor's
     *  session-builder after resolving `sceneItemId` against the canvas. */
    public setBoundSceneView(view: SceneStateView | null): void {
        this._boundSceneView = view;
    }

    // ── Body-frame gravity (cached, dirty-checked) ────────────────────
    //
    // The scene's gravity is a LATENT, world-fixed vector; the world
    // matrix is only this object's POSE and does NOT change the gravity.
    // What a world object needs for gravity coupling is that same gravity
    // expressed in its OWN body frame: g_body = R^T * g_world (R = the
    // rotation block of `world`). That projection depends solely on the
    // gravity (effectively constant) and this object's orientation (rarely
    // changing), so it is computed ONCE and cached, recomputed only when
    // the gravity value changes or the world transform changes. Reused
    // instance: no per-tick allocation.

    /** Cached body-frame gravity (R^-1 * g_world). PRESENCE is the binding
     *  signal: `undefined` means no scene is bound (inert / gravity-free),
     *  a vector means it holds the current projection. A subclass reads it
     *  after calling `super._updateGravityCoupling` and branches on
     *  undefined for its gravity-free path. The instance is reused while
     *  bound (no per-tick allocation); only a (re)bind allocates one. */
    protected _bodyGravity?: ICartesian3;

    /** Set by `fire()` whenever `_world` changes; consumed (cleared) by
     *  `_updateGravityCoupling` the next time it recomputes the body
     *  gravity. The orientation is what makes the projection stale. */
    private _worldChangedForGravity: boolean = true;

    /**
     * Refresh the cached body-frame gravity from the bound scene and this
     * object's current world pose, but only when it can have changed: the
     * orientation moved (`_worldChangedForGravity`) or there is no cache yet.
     * Gravity itself is a CONSTANT scene latent (a scene / binding swap goes
     * through `reset()`, which drops this cache), so it needs no value
     * compare. Returns `true` when it recomputed `_bodyGravity` this call (so
     * a subclass can recompute its own gravity-derived constants in
     * lock-step), `false` on a cache hit or when no scene is bound.
     *
     * Resident here (not in a plugin) so every world object shares one
     * dirty-checked projection; OVERRIDABLE so a subclass (e.g. the PMSM
     * machine) can call `super._updateGravityCoupling(session)` and then
     * fold the body gravity into its own coupling. Gated on a BOUND scene
     * (not the Earth fallback) so a headless drive with no scene stays
     * gravity-free and deterministic.
     */
    protected _updateGravityCoupling(session: ISession): boolean {
        const scene = this.boundScene(session);
        if (!scene) {
            if (this._bodyGravity !== undefined) {
                this._bodyGravity = undefined; // transitioned to no-gravity
                return true;
            }
            return false;
        }
        // Cache hit: a scene is bound AND the orientation has not moved.
        if (this._bodyGravity !== undefined && !this._worldChangedForGravity) {
            return false;
        }
        // g_body = R^-1 · g_world, composed from PURE Matrix4 primitives
        // (no inline indexing, no domain method on the matrix). The world is
        // a rigid body->world transform, so R^-1 = R^T: transpose, then apply
        // to the direction. That rigid-body equivalence is the domain choice.
        // Allocate the body-gravity vector lazily on (re)bind; reuse while bound.
        const out = (this._bodyGravity ??= new Cartesian3());
        // Load the current world, transpose it (= inverse rotation for the
        // rigid body->world transform), apply to world-frame gravity -> body.
        this._m4WorldRotInv.setFromArray(this._worldFlat);
        this._m4WorldRotInv.transposeToRef(this._m4WorldRotInv);
        this._m4WorldRotInv.transformDirectionToRef(scene.gravity, out);
        this._worldChangedForGravity = false;
        return true;
    }

    public readonly inputPorts: ReadonlyArray<IPortDescriptor> = TransformNode.TRANSFORM_INPUT_PORTS;
    public readonly outputPorts: ReadonlyArray<IPortDescriptor> = TransformNode.TRANSFORM_OUTPUT_PORTS;

    public constructor(onsc: Nullable<IOlink[]> = null, opsc: Nullable<IOlink[]> = null, position?: ICartesian) {
        super(onsc, opsc, position);
    }

    /** Current world transform in flat (`Matrix44`) form: equals
     *  parentWorld × local after the last fire() consumed inputs. */
    public get world(): ReadonlyArray<number> {
        return this._worldFlat;
    }

    /** Local pose (see IHasTransform): the wired `local` port override when
     *  active, else the node's (position, orientation) pose. */
    public override localTransform(): Matrix4 {
        return this._localOverrideActive && this._localOverride ? this._localOverride : super.localTransform();
    }

    /** World pose (see IHasTransform): `parentWorld × local`, where
     *  parentWorld follows the precedence wired `parentWorld` override >
     *  structural `parent` (the enclosing scene, wired at bind). With
     *  neither, it degrades to the bare local pose. */
    public override worldTransform(): Matrix4 {
        const local = this.localTransform();
        let parentWorld: IMatrix4 | undefined;
        if (this._parentWorldActive && this._parentWorldOverride) {
            parentWorld = this._parentWorldOverride;
        } else if (this.parent) {
            parentWorld = this.parent.worldTransform();
        }
        if (parentWorld === undefined) {
            return local;
        }
        const world = this.composeWorldInto(local, parentWorld, (this._worldMatrix ??= new Matrix4()));
        return world;
    }

    /**
     * Returns the effective scene view for the current tick. Reads
     * `session.sceneStateView` when bound, else a per-node Earth-surface
     * default. The returned view's accessors are live:
     *
     *     const g = this.getScene(session).gravity;     // ICartesian3
     *     const T = this.getScene(session).temperature; // K
     */
    protected getScene(session: ISession): SceneStateView {
        const scene = this.boundScene(session);
        if (scene) return scene;
        if (!this._fallbackSceneView) {
            this._fallbackSceneView = buildDefaultStateView("__transform_fallback__");
        }
        return this._fallbackSceneView;
    }

    /**
     * The effective scene for this node WITHOUT the Earth fallback:
     * per-node binding wins, then the session scene, else null. Callers
     * that must distinguish "a real scene is bound" from "nothing"
     * (e.g. gravity coupling that should stay inert with no scene) use
     * this rather than `getScene()`.
     */
    protected boundScene(session: ISession): SceneStateView | null {
        return this._boundSceneView ?? session.sceneStateView ?? null;
    }

    public override reset(_session: ISession): void {
        // Drop the composed world + the port overrides; the next fire
        // recomposes from the freshly bound scene + pose.
        this._worldFlat = (IDENTITY44 as number[]).slice();
        this._localOverrideActive = false;
        this._parentWorldActive = false;
        // Drop the body-gravity cache so the first fire after a reset
        // recomputes it against the freshly bound scene + pose.
        this._bodyGravity = undefined;
        this._worldChangedForGravity = true;
    }

    public override fire(session: ISession, _t: number): void {
        // Capture this tick's transform inputs (ports + scene) as fields so
        // the pull methods report the same pose the `world` port publishes.
        // Reads by slot via the routing-cache helpers (O(1), no opsc() scan,
        // no string-match, no linear indexOf); consumeLatest = last ready wins.

        // `local` port override (else the node's (position, orientation) pose).
        const localV = this.consumeLatest(session, TransformNode.INPUT_LOCAL);
        if (isMatrix44(localV)) {
            (this._localOverride ??= new Matrix4()).setFromArray(localV);
            this._localOverrideActive = true;
        } else {
            this._localOverrideActive = false;
        }

        // `parentWorld` port override (wins over the scene parent below).
        const parentV = this.consumeLatest(session, TransformNode.INPUT_PARENT_WORLD);
        if (isMatrix44(parentV)) {
            (this._parentWorldOverride ??= new Matrix4()).setFromArray(parentV);
            this._parentWorldActive = true;
        } else {
            this._parentWorldActive = false;
        }

        // world = parentWorld × local, composed through the node's own
        // transform (override-aware). Flag the body-gravity projection stale
        // only when the world actually moved (see _updateGravityCoupling);
        // a fresh flat array is published only on change.
        const world = this.worldTransform();
        if (!world.equalsArray(this._worldFlat)) {
            this._worldFlat = world.toArrayRef(new Array<number>(16));
            this._worldChangedForGravity = true;
        }
        this.publishAll(session, TransformNode.OUTPUT_WORLD, this._worldFlat);
    }
}
