/**
 * `Sim.Graph:graph` — the explicit fractal-container RuntimeNode.
 *
 * The runtime already supports fractal sub-graphs via `RuntimeGraph` +
 * `IGraphNodeState.internalSession` (each parent session that embeds a
 * RuntimeGraph allocates a distinct inner Session, so the same graph
 * topology can be embedded by N parents without state sharing). That
 * mechanism was invisible on the canvas; SimGraphNode promotes it to a
 * palette-droppable entity with the two extra contracts the v2
 * architecture needs:
 *
 *   1. **Scene binding** — `@cloneable sceneItemId` points at a
 *      SceneItem (a `GraphItem`) living in the same canvas. At
 *      `reset(parentSession)`, the editor's session-builder hands the
 *      SimGraphNode a `SceneStateViewResolver` that maps the ID to a
 *      live `SceneStateView`; the view is written into
 *      `innerSession.sceneStateView` so every TransformNode-derived
 *      node inside this sub-graph reads its gravity / temperature /
 *      transform from the wired Scene rather than from a default.
 *
 *   2. **Multi-rate sub-stepping** — `fire(parentSession, t)`
 *      computes the ratio K = innerHz / parentHz at every call (cheap;
 *      both Hz values are getters on the bound SceneStateView), then
 *      runs `innerSession.run()` K times between the parent's previous
 *      and current sim-time. Inputs are routed in ONCE before the
 *      sub-step loop (ZOH semantics — the inner integrator sees the
 *      parent's last-published value held across K micro-steps) and
 *      outputs routed out ONCE after, matching the F9 / `Helios.Sim:rate-group`
 *      design. K is clamped to ≥ 1, so a child with a slower (or
 *      identical) rate falls back to a single inner.run per parent
 *      fire.
 *
 * Solver attachment to the inner session lands in P4 (Solver-node
 * refactor); V1 of this node only wires the SceneStateView and runs
 * the sub-step loop.
 *
 * Inheritance choice: SimGraphNode subclasses `RuntimeGraph` rather
 * than composing one. Subclassing reuses the input/output port
 * routing, the IGraphNodeState factory, the control plane, and the
 * `reset()` cascade for free; the only new code paths are the scene
 * binding in reset() and the K-loop in fire().
 */

import { cloneable } from "../graph/graph.interfaces";
import type { IChannel, ISession, ISolverHandle } from "../execution/execution.interfaces";
import { RuntimeGraph } from "../execution/execution.graph";
import { Frequency } from "../math/math.units";
import { InheritedSceneStateView } from "./scene-state-view.impl";
import { MIN_EFFECTIVE_HZ } from "./scene-state-view.interface";
import type { SceneStateView } from "./scene-state-view.interface";
import { IDENTITY44, isMatrix44, Matrix4 } from "../geometry/geometry.matrix";
import type { IHasTransform } from "../geometry/geometry.interfaces";
import { hasSampleRateRequirement, isSceneResident } from "./sim.interfaces";
import type { ILiveInScene } from "./sim.interfaces";

/**
 * Resolver protocol the editor's session-builder hands to a
 * SimGraphNode at session bind. Bundles the two scene-related
 * lookups the SimGraphNode needs at `reset()`:
 *
 *   - `buildView`: map a `sceneItemId` (the SceneItem's editor
 *     identity) to a live `SceneStateView` bound to the calling
 *     SimGraphNode's inner session.
 *   - `buildSolverAttachments`: enumerate the solvers wired to the
 *     SceneItem (via its `solverItemIds`), build each one's
 *     `ISolverHandle` instance from its editables, register the leaves
 *     it owns, and return the handles ready for `inner.attachSolver`.
 *
 * Both lookups are scoped to the same SceneItem, which is why they
 * live on a single interface rather than two parallel function-style
 * resolvers — the editor implements the two together and the
 * SimGraphNode invokes both inside the same reset() pass.
 *
 * Returns `null` / empty when the ID is unknown (item missing / not
 * yet created / typo) — SimGraphNode falls back to a default view
 * silently rather than throwing, matching the editor's tolerance for
 * transient invalid wirings during topology edits.
 *
 * Core has no SceneItem class (that lives in `plugins/physics/scene`)
 * and no concrete SolverNode (those live in `plugins/control/sim`),
 * so this interface is the seam that lets the editor wire all three
 * together without pulling the plugin layer into core's import graph.
 */
export interface SceneBindingResolver {
    buildView(sceneItemId: string, innerSession: ISession): SceneStateView | null;
    buildSolverAttachments(sceneItemId: string, innerSession: ISession): ReadonlyArray<ISolverHandle>;
}

export class SimGraphNode<
    N extends import("../execution/execution.interfaces").IRuntimeNode = import("../execution/execution.interfaces").IRuntimeNode,
    L extends IChannel = IChannel,
>
    extends RuntimeGraph<N, L>
    implements ILiveInScene
{
    /** ILiveInScene brand: a sub-graph container is a world object. Its
     *  transform `parent` is wired to the enclosing scene at bind, so
     *  `worldTransform()` chains container -> scene -> ... -> root; its own
     *  inner residents parent to it (wired in reset()). */
    public readonly livesInScene = true as const;

    /** Identifier of the SceneItem this sub-graph belongs to. Set by
     *  the editor when the user wires a SceneItem to this Sim.Graph
     *  via a config-link (P5). Empty string means "no scene wired"
     *  → falls back to a default Earth-surface view. */
    @cloneable public sceneItemId: string = "";

    /** Serialized interior of this container (a version-3 sub-graph
     *  document: model nodes + name-addressed connections + boundary
     *  ports). Seeded by a palette factory that ships a pre-built
     *  assembly, or written by the editor's drill-down on leaveSubGraph.
     *  `materializeSubGraphInto` parses it at session build to populate
     *  this node's interior; empty string means "interior built another
     *  way" (the builder API, or a still-empty fresh container). */
    @cloneable public subGraphJson: string = "";

    /** Editor-injected resolver; null means the SimGraphNode is being
     *  used outside an editor session-build (unit tests, headless
     *  driver) and should fall back to defaults. */
    private _bindingResolver: SceneBindingResolver | null = null;

    /** Solvers we attached to the inner session on the most recent
     *  reset(). Tracked so we can detach them on a subsequent reset()
     *  (re-bind / re-configure) without leaving stale solvers
     *  registered. */
    private _attachedSolvers: ISolverHandle[] = [];

    /** Last sim-time observed by `fire()`; used to compute the sub-step
     *  dt = (t - _lastFiredAt) / K. Initialised to -Infinity so the
     *  very first fire treats `t` as both endpoints (no time has
     *  elapsed yet). */
    private _lastFiredAt: number = -Infinity;

    // ── Transform participation (the "graph is a TransformNode" seam) ──
    //
    // A Sim.Graph is itself a world object: it accepts a `local` pose
    // (matrix44) within its enclosing scene and exposes its composed
    // `world` (matrix44). It carries no `parentWorld` port of its own:
    // the parent frame IS the enclosing scene, inherited through the
    // fractal nesting (see _bindInnerSceneView), so chaining is done by
    // nesting Sim.Graphs rather than by wiring a parallel transform tree
    // (which would double-count the scene origin).

    public static readonly INPUT_LOCAL = "local";
    public static readonly OUTPUT_WORLD = "world";

    // ── World-pose composition (via the node's own IHasTransform) ─────
    //
    // world = enclosingSceneWorld × local. The MATH lives once in the base
    // `GraphNode` (pose → local → parent × local, via `composeWorldInto`);
    // this node layers the SIM concerns: the wired `local` port OVERRIDE and
    // the enclosing scene as
    // the (only) parent frame. A Sim.Graph has NO parentWorld port — the
    // parent frame IS the enclosing scene, inherited through the fractal
    // nesting, so chaining is done by nesting Sim.Graphs rather than wiring
    // a parallel transform tree (which would double-count the scene origin).

    /** Wired `local` port override (reused buffer); `_localOverrideActive`
     *  gates whether it wins over this sub-graph's (position, orientation). */
    private _localOverride?: Matrix4;
    private _localOverrideActive: boolean = false;

    /** Reused world buffer for the per-fire `parentWorld × local` compose
     *  (lazily allocated), so the runtime push path allocates no 4×4 per tick. */
    private _worldMatrix?: Matrix4;

    /** Composed world in flat (`Matrix44`) form, published on the `world`
     *  port. Fresh array only on change (consumers may hold the reference). */
    private _worldFlat: number[] = (IDENTITY44 as number[]).slice();

    /**
     * Inject the scene binding resolver. The editor's session-builder
     * calls this once per build, before the parent session's
     * `reset()` cascades into this node's own `reset()`.
     */
    public setSceneBindingResolver(resolver: SceneBindingResolver | null): void {
        this._bindingResolver = resolver;
    }

    /**
     * Reset the inner session and bind its `sceneStateView`. The
     * resolver lookup happens lazily here (not at construction) so a
     * topology edit that re-wires the scene takes effect on the next
     * play without recreating the SimGraphNode instance.
     */
    public override reset(parentSession: ISession): void {
        super.reset(parentSession);
        const inner = this._internalSessionIn(parentSession);
        if (!inner) return;

        // Detach solvers from the previous bind, if any. Idempotent
        // when the list is empty (first reset()). Doing this BEFORE
        // we ask the resolver for a fresh set means a topology edit
        // that swaps the SceneItem cleanly tears down the old solvers
        // before the new ones arrive.
        for (const solver of this._attachedSolvers) {
            inner.detachSolver(solver);
        }
        this._attachedSolvers = [];

        // ── Scene view binding ───────────────────────────────────────
        let view: SceneStateView | null = null;
        if (this.sceneItemId && this._bindingResolver) {
            view = this._bindingResolver.buildView(this.sceneItemId, inner);
        }
        if (!view) {
            // No SceneItem of its own: INHERIT the enclosing scene rather
            // than fabricating a fresh Earth default. The inner view reads
            // the parent session's live sceneStateView through a thunk
            // (so a root binding established after this reset is picked up
            // with no rebuild) and composes this sub-graph's local pose
            // into the chained worldTransform. Scene context thus flows
            // DOWN the fractal hierarchy, exactly as a TransformNode
            // composes parentWorld × local. When the parent has no view
            // yet, the inherited view degrades to Earth-surface defaults.
            view = new InheritedSceneStateView(`__sim_graph_${this.sceneItemId || "unbound"}`, () => parentSession.sceneStateView);
        }
        inner.sceneStateView = view;

        // ── Single-truth transform: parent inner residents to this ───
        // Each inner world object's structural `parent` IS this container, so
        // `worldTransform()` chains inner-object -> this -> enclosing scene ->
        // ... -> root via `parent.worldTransform()` (no scene-view transform).
        // Gravity / latents still flow via the inner `sceneStateView` set
        // above; an own inner SceneItem contributes its latents through that
        // view (its transform pose folds into the container frame).
        for (const node of inner.graph.nodes) {
            // ILiveInScene is orthogonal to IHasTransform; a runtime resident is
            // a GraphNode, so it carries the geometry `parent` we wire here.
            if (isSceneResident(node)) (node as unknown as IHasTransform).parent = this;
        }

        // ── Solver attachment ────────────────────────────────────────
        // Each entry in the resolver's array is an already-initialised
        // ISolverHandle ready to step. SimGraphNode just hands it over
        // to the inner session — the session will invoke step() at
        // the start of every inner.run() (integration phase, F3).
        if (this.sceneItemId && this._bindingResolver) {
            const attachments = this._bindingResolver.buildSolverAttachments(this.sceneItemId, inner);
            for (const solver of attachments) {
                inner.attachSolver(solver);
                this._attachedSolvers.push(solver);
            }
        }

        this._lastFiredAt = -Infinity;
        this._worldFlat = (IDENTITY44 as number[]).slice();
        this._localOverrideActive = false;
    }

    /**
     * Fire the sub-graph with K sub-steps where K = ceil(innerHz / parentHz).
     *
     * Routing model:
     *   - Inputs are routed from the parent session into the inner
     *     ONCE at the start of fire(). The first sub-step sees fresh
     *     parent values; subsequent sub-steps see whatever the inner
     *     nodes themselves have made of them (ZOH on parent
     *     boundaries).
     *   - The inner session runs K times, each at `_lastFiredAt + k*dt`.
     *   - Outputs are routed back from the inner to the parent ONCE
     *     at the end. The parent sees the inner's terminal state for
     *     this macro-step.
     *
     * K-clamping: a child whose Scene declares `effectiveHz` ≤ parent
     * Hz collapses to a single inner.run. We don't allow K < 1 (would
     * skip the inner entirely) or fractional K (the runtime works in
     * discrete ticks).
     */
    public override fire(parentSession: ISession, t: number): void {
        // 1) Consume the `local` pose and compose this sub-graph's world
        //    from the enclosing scene BEFORE routing, so `local` is not
        //    mistaken for a boundary input destined for the inner graph.
        this._updateTransform(parentSession);

        const inner = this._routeInputsFromParent(parentSession);
        if (inner) {
            const K = this._computeSubStepRatio(parentSession, inner);
            // First fire after reset() has no recorded "previous t"; we
            // anchor the span at 0 (start-of-sim convention). Sub-steps
            // therefore spread evenly from 0 to t on the first call,
            // matching what the user sees when a fixed-rate runner kicks
            // off a fresh play (`GraphRunner.play()` resets t = 0 then
            // immediately calls run(dt) for the first frame).
            const lastT = this._lastFiredAt === -Infinity ? 0 : this._lastFiredAt;
            const span = t - lastT;
            const dt = K > 0 ? span / K : span;

            for (let k = 1; k <= K; k++) {
                inner.run(lastT + k * dt);
            }
            this._lastFiredAt = t;

            this._routeOutputsToParent(parentSession, inner);
        }

        // 2) Publish the composed world for OUTER consumers (siblings,
        //    visualisation) regardless of whether the inner ran this tick.
        this._publishWorld(parentSession);
    }

    /**
     * Read the `local` pose port (if wired) and recompose this sub-graph's
     * world from its `parent` (the enclosing scene, wired at bind). Publishes
     * `_worldFlat` on the `world` output. `local` is consumed here so
     * `_routeInputsFromParent` does not see it as a ready boundary token.
     */
    private _updateTransform(parentSession: ISession): void {
        // Consume the `local` port override via the routing cache (this also
        // keeps _routeInputsFromParent from re-seeing it as a boundary token).
        // A Sim.Graph has NO parentWorld port: the parent frame IS the
        // enclosing scene, wired as this node's `parent` at session bind.
        const localV = this.consumeLatest(parentSession, SimGraphNode.INPUT_LOCAL);
        if (isMatrix44(localV)) {
            (this._localOverride ??= new Matrix4()).setFromArray(localV);
            this._localOverrideActive = true;
        } else {
            this._localOverrideActive = false;
        }

        // world = parent.worldTransform() × local through the node's own
        // transform; publish a fresh flat array only on change.
        const world = this.worldTransform();
        if (!world.equalsArray(this._worldFlat)) {
            this._worldFlat = world.toArrayRef(new Array<number>(16));
        }
    }

    /** Local pose (see IHasTransform): the wired `local` port override when
     *  active, else this sub-graph's (position, orientation) pose. */
    public override localTransform(): Matrix4 {
        return this._localOverrideActive && this._localOverride ? this._localOverride : super.localTransform();
    }

    /** World pose (see IHasTransform): `parent.worldTransform() × local`,
     *  where `parent` is the enclosing scene (wired at bind). A Sim.Graph has
     *  no parentWorld port. With no parent it degrades to the bare local pose. */
    public override worldTransform(): Matrix4 {
        const local = this.localTransform();
        const parent = this.parent;
        if (parent === undefined) {
            return local;
        }
        const world = this.composeWorldInto(local, parent.worldTransform(), (this._worldMatrix ??= new Matrix4()));
        return world;
    }

    /** Publish the composed `world` matrix on the outgoing `world` port. */
    private _publishWorld(parentSession: ISession): void {
        this.publishAll(parentSession, SimGraphNode.OUTPUT_WORLD, this._worldFlat);
    }

    /**
     * K = max(1, round(innerHz / parentHz)).
     *
     * Hz lookups (P8, 2026-06-09): priority order
     *   1. The session's bound SceneStateView's `effectiveHz`. When a
     *      SceneItem is wired through the SceneBindingResolver, this
     *      reflects either the user's `manualHz` override or the
     *      resolver's aggregate over the scene's solver-attached
     *      leaves.
     *   2. Per-graph aggregation: walk this graph's nodes and take
     *      max(requiredHz) over every IHasSampleRateRequirement
     *      implementer, floored at MIN_EFFECTIVE_HZ. This is the
     *      "no SceneItem wired" fallback — the runtime still figures
     *      out a sensible rate from what's inside the sub-graph.
     *   3. None of the above → null → K = 1 (no sub-stepping).
     *
     * The legacy `ISession.simRate` field is no longer consulted; the
     * runner's fixed-step rate is now ONLY a wall-clock cadence
     * concern, not a sim-time rate.
     */
    private _computeSubStepRatio(parentSession: ISession, inner: ISession): number {
        const myHz = this._readHz(inner);
        const parentHz = this._readHz(parentSession);
        if (!myHz || !parentHz || parentHz <= 0) return 1;
        const ratio = myHz / parentHz;
        if (!Number.isFinite(ratio) || ratio <= 1) return 1;
        return Math.max(1, Math.round(ratio));
    }

    private _readHz(session: ISession): number | null {
        // 1. Bound SceneStateView wins when present.
        const view = session.sceneStateView;
        if (view) {
            const hz = view.effectiveHz.getValue(Frequency.Units.Hz);
            if (Number.isFinite(hz) && hz > 0) return hz;
        }
        // 2. P8 fallback: aggregate from the graph's own
        //    IHasSampleRateRequirement nodes (max + floor). Looks
        //    THROUGH the session, not into the inner state — the inner
        //    session's graph IS this SimGraphNode itself when reading
        //    inner, or whatever runtime graph the runner mounted when
        //    reading parent.
        const agg = SimGraphNode._aggregateRequiredHzFromSession(session);
        if (agg > 0) return agg;
        return null;
    }

    /**
     * Walk a session's graph nodes, take max(requiredHz) over every
     * IHasSampleRateRequirement implementer, floor at MIN_EFFECTIVE_HZ.
     * Returns 0 when no opt-in nodes are present (caller falls back
     * to a different signal).
     *
     * Static helper so a caller without a SimGraphNode instance (e.g.
     * the GraphRunner) can reach for the same aggregation rule.
     */
    public static _aggregateRequiredHzFromSession(session: ISession): number {
        const nodes = session.graph?.nodes;
        if (!nodes || nodes.length === 0) return 0;
        let max = 0;
        for (const node of nodes) {
            if (hasSampleRateRequirement(node)) {
                if (node.requiredHz > max) max = node.requiredHz;
            }
        }
        if (max <= 0) return 0;
        const floor = MIN_EFFECTIVE_HZ.getValue(Frequency.Units.Hz);
        return Math.max(floor, max);
    }
}

/** Free-standing factory invoked by the sub-plugin's `activate`. */
export function createSimGraphNode(): SimGraphNode {
    return new SimGraphNode();
}
