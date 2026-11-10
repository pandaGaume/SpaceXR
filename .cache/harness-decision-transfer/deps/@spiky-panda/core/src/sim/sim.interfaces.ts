import { IRuntimeNode, ISession } from "../execution/execution.interfaces";

/**
 * Sim layer: time-discrete simulation extension on top of core/execution.
 * The runtime layer is pure KPN/dataflow and knows nothing about phases;
 * this file adds the phase concept as a session-level context and an
 * opt-in interface that nodes implement when they want to gate themselves
 * on the current phase.
 */

/**
 * Named scheduling phases for time-discrete simulation. SimSession
 * iterates these in declaration order at each tick, setting
 * currentPhase before dispatching the underlying scheduler. Domain
 * extensions append new phases to this enum, the type intentionally
 * stays closed (no arbitrary strings).
 */
export enum SimPhase {
    PreStep = 0,
    Step = 1,
    PostStep = 2,
}

/**
 * Sim-specific session: extends the generic ISession with the phase
 * currently being dispatched. SimSession sets this once per phase
 * iteration before draining the ready-queue; nodes that implement
 * ISupportsPhasing read it via the session cast to gate themselves.
 */
export interface ISimSession extends ISession {
    readonly currentPhase: SimPhase;
    readonly phases: ReadonlyArray<SimPhase>;
}

/**
 * Per-node session-bag for phased nodes. Marker interface for now:
 * subclasses extending PhasedNode that need richer temporal state
 * (last-fired timestamp per phase, integrator accumulators, etc.)
 * declare their own interface extending this and re-parameterise
 * `PhasedNode<B extends IPhasedNodeBag = IPhasedNodeBag>`.
 */
// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface IPhasedNodeBag {}

/**
 * Opt-in marker for nodes that gate themselves on the current phase.
 * Nodes not implementing this fire whenever their inputs are ready,
 * regardless of phase (pure KPN behaviour). Nodes implementing this
 * skip phases not in their declared list even when data is ready.
 *
 * The scheduler itself remains phase-agnostic; the gating happens in
 * the node's isReady() (see PhasedNode for the canonical implementation).
 */
export interface ISupportsPhasing {
    readonly phases: ReadonlyArray<SimPhase>;
}

/**
 * Type guard for ISupportsPhasing on a runtime node.
 */
export function supportsPhasing(n: IRuntimeNode): n is IRuntimeNode & ISupportsPhasing {
    const candidate = n as IRuntimeNode & Partial<ISupportsPhasing>;
    return Array.isArray(candidate.phases);
}

// =====================================================================
// Scene residency (scene-context membership; ORTHOGONAL to pose)
// =====================================================================

/**
 * Opt-in marker: this node PARTICIPATES IN A SCENE — it consumes the scene
 * context (gravity, atmosphere, temperature, ...) via `getScene()`.
 *
 * INTENTIONALLY NOT `extends IHasTransform`. Living in a scene and carrying a
 * geometric pose are ORTHOGONAL concerns:
 *   - An air / atmosphere analyzer MUST read the ambient scene (atmosphere,
 *     gravity) yet has no meaningful geometric placement — it is `ILiveInScene`
 *     but its pose is irrelevant.
 *   - A neuron carries an NN quadtree/octree `position` (`IHasTransform`) but
 *     does NOT live in a scene — purely conceptual.
 *   - A world object (motor, sensor, sub-graph container, SceneItem) is BOTH:
 *     `ILiveInScene` AND `IHasTransform`.
 *
 * The scene a resident sees is resolved by `getScene()`: a direct per-node
 * binding (the `scene` config-link) wins; otherwise it inherits the enclosing
 * scene through the geometry parent hierarchy up to the root scene (the scene
 * sits at the root of that hierarchy, surfaced via the session scene view and
 * the fractal `InheritedSceneStateView`). A world object additionally uses that
 * same parent chain for its `worldTransform()` (the single-truth pose); a
 * non-geometric resident uses it only to LOCATE its scene.
 *
 * `livesInScene` is a constant brand (mirrors how `ISupportsPhasing` is
 * discriminated by its `phases` array) so the marker is discriminable at
 * runtime without coupling the type to `IHasTransform`.
 */
export interface ILiveInScene {
    readonly livesInScene: true;
}

/** Structural guard for `ILiveInScene`. True when the node carries the
 *  `livesInScene === true` brand. */
export function isSceneResident(n: unknown): n is ILiveInScene {
    return !!n && typeof n === "object" && (n as { livesInScene?: unknown }).livesInScene === true;
}

/**
 * Type guard for ISimSession on a generic ISession. True when the
 * session carries the sim-specific currentPhase + phases fields, which
 * is the contract SimSession adds on top of Session.
 */
export function isSimSession(s: ISession): s is ISimSession {
    const candidate = s as ISession & Partial<ISimSession>;
    return typeof candidate.currentPhase === "number" && Array.isArray(candidate.phases);
}

// =====================================================================
// Continuous-time integration (F1 — IIntegrable opt-in trait)
// =====================================================================

/**
 * Inputs the solver hands to a leaf's `rhs(t, y, inputs, dydt)` call.
 * The solver assembles this snapshot once per macro-tick by reading the
 * leaf's incoming linkStates; rhs evaluations within one macro-tick all
 * see the SAME inputs (per Q1.2 resolution in the v2 plan). This avoids
 * mid-step input drift while remaining cheap to evaluate because
 * upstream publish rates are bounded by the parent scheduler tick rate.
 *
 * Read-only. Keys are input port names (the leaf's incoming slots).
 */
export interface IIntegrationInputs {
    get(portName: string): number | undefined;
    has(portName: string): boolean;
    /**
     * Sum every input whose port name starts with `prefix`. Returns 0
     * when no slot matches (the AtmosphereStateNode's rhs relies on
     * this: "if nothing is wired on `delta_CO2_*` yet, the species
     * inventory just doesn't change this tick").
     *
     * The contract is intentionally minimal — no allocation, no slot
     * enumeration leaked to the caller. Implementations are expected
     * to be O(N) where N is the total slot count, since N is bounded
     * by the leaf's port descriptor and we don't care about
     * micro-optimising the rhs cost given the solver's own outer cost.
     */
    sumPrefix(prefix: string): number;
}

/**
 * Optional trait a RuntimeNode can implement to participate in
 * continuous-time integration. ORTHOGONAL to the existing fire(t)
 * contract — implementing this trait DOES NOT change anything until a
 * solver attached to the session adopts the leaf at reset().
 *
 *   - Nodes that DON'T implement IIntegrable keep their current
 *     fire(session, t) behaviour. Existing motors, oscillators, DSP
 *     ops are unaffected.
 *   - Nodes that DO implement IIntegrable opt out of doing integration
 *     in fire() and instead expose their state vector + rhs to whatever
 *     solver lives in the containing graph. fire() becomes pure I/O:
 *     it reads the just-updated state and publishes observation outputs.
 *     The solver owns the dt loop, including adaptive micro-stepping
 *     for accuracy.
 *
 * Migration is localised (one node at a time) and reversible (drop the
 * trait, fire() goes back to whatever it did before).
 *
 * All slice indexing uses (y, offset) — leaves co-exist in one shared
 * state vector owned by the solver, each leaf writing to its slice
 * `[offset .. offset+stateSize)`.
 */
export interface IIntegrable {
    /**
     * Size of this leaf's local state vector. 0 is illegal — stateless
     * nodes don't implement IIntegrable. Frozen at compile time (per
     * Q1.1 resolution): the solver caches offsets and a topology edit
     * forces a session reset, which rebuilds the solver state.
     */
    readonly stateSize: number;

    /**
     * Names of state entries, length === stateSize. Surfaced in the
     * property panel + diagnostic tiles (DMD, conservation auditors).
     * Strongly recommended even when stateSize === 1 so dashboards can
     * label series meaningfully.
     */
    readonly stateNames?: ReadonlyArray<string>;

    /**
     * Solver kind this leaf wants to be integrated with. Leaf-centric
     * pull pattern (replaces the old solver-side `leafFilter` glob):
     * at session bind, the attachment helper groups leaves by this
     * field and resolves each group's descriptor from the Scene's
     * solver list — auto-filling from `SOLVER_REGISTRY` defaults if
     * the Scene doesn't carry that kind.
     *
     * Optional with a default of `DEFAULT_SOLVER_KIND` ("rk4-adaptive").
     * Legacy leaves that don't declare it fall into the default group.
     */
    readonly solverKind?: string;

    /**
     * Per-leaf option overrides. Merged with the descriptor's
     * `commonOptions` by `mergeSolverOptions` (tightening rules: min
     * for tolerance / maxStep, max for minStep). Lets a single fast
     * leaf request a tighter step cap without burdening the rest of
     * the same solver's leaves.
     *
     * Optional. When absent, the descriptor's options apply as-is.
     */
    readonly solverOptions?: import("./solver.registry").ISolverOptions;

    /**
     * Copy this leaf's current state INTO `y[offset .. offset+stateSize)`.
     * Called by the solver at the start of each accepted macro-step and
     * by Snapshot Restore. Must NOT mutate the leaf's own state.
     */
    gatherState(y: Float64Array, offset: number): void;

    /**
     * Copy `y[offset .. offset+stateSize)` back INTO this leaf's local
     * state. Called by the solver at the end of each accepted macro-step
     * and by Snapshot Restore. Implementations should use the existing
     * `setField` pattern when present so viewables + LiveBinder still
     * propagate the change to the UI.
     */
    writeState(y: Float64Array, offset: number): void;

    /**
     * Compute dy/dt at sim-time `t` given state `y`. PURE: must not
     * read or write any state outside the (y, dydt) slice. Upstream
     * input values arrive in `inputs`; the solver assembles that
     * snapshot once per macro-tick.
     *
     *   y     full state vector (shared with other leaves)
     *   offset start of this leaf's slice
     *   inputs upstream port values, indexed by input port name
     *   dydt   output slice to fill; same indexing convention as y
     */
    rhs(t: number, y: Float64Array, offset: number, inputs: IIntegrationInputs, dydt: Float64Array): void;

    /**
     * Optional analytic Jacobian d(rhs)/dy for this leaf. Returns a
     * (stateSize × stateSize) matrix as a flat row-major Float64Array.
     * When absent the solver finite-differences it — fine for explicit
     * methods (RK4) but important when implicit solvers arrive
     * (Rosenbrock, IDA / CVODES) where Jacobian accuracy dominates cost.
     */
    jacobian?(t: number, y: Float64Array, offset: number, inputs: IIntegrationInputs, J: Float64Array): void;
}

/**
 * Structural duck-type guard for IIntegrable. Used by the solver
 * marker node at session reset() to filter leaves before claiming them.
 * Intentionally strict: we want a positive answer ONLY when the node
 * declares all four mandatory members (stateSize, gatherState,
 * writeState, rhs). `stateNames` and `jacobian` are optional and not
 * checked.
 */
export function isIntegrable(node: unknown): node is IIntegrable {
    if (!node || typeof node !== "object") return false;
    const n = node as Partial<IIntegrable>;
    return typeof n.stateSize === "number" && n.stateSize > 0 && typeof n.gatherState === "function" && typeof n.writeState === "function" && typeof n.rhs === "function";
}

// =====================================================================
// Sample-rate requirement (P8 — IHasSampleRateRequirement)
// =====================================================================

/**
 * Opt-in trait a node declares to advertise the sample rate (in Hz)
 * it needs to be stepped at for its physics / integration to be
 * meaningful. Read by the enclosing SimGraphNode at reset() time to
 * compute the inner session's `effectiveHz` via max(requiredHz) over
 * all opt-in leaves, with a floor of `MIN_EFFECTIVE_HZ` (60 Hz).
 *
 * Replaces the legacy global `session.simRate` dropdown: rates are
 * now declarative and locally meaningful (motors want kHz, atmospheres
 * want ~100 Hz, slow chemistry might want 10 Hz), and the runner just
 * honors the union.
 *
 * Canonical SI: Hz. Nodes that need unit-aware code can wrap their
 * stored value in a `Frequency` Quantity for property panels and
 * configuration round-trips, but the interface itself trades raw
 * numbers for cheap hot-path reads.
 *
 * The trait is ORTHOGONAL to IIntegrable: not every IIntegrable has
 * to declare a requiredHz (the floor handles it), and a fast
 * non-integrating node can also opt in if its own internal dynamics
 * dictate a sample rate (e.g. a Nyquist-bound sensor).
 *
 * When the SimGraphNode wraps a sub-graph, the inner-graph aggregate
 * becomes the SimGraphNode's own effective rate, which then bubbles
 * up via its parent's K = innerHz / parentHz sub-stepping ratio.
 */
export interface IHasSampleRateRequirement {
    /** Required sample rate in hertz. MUST be > 0 (a node that opts in
     *  declares a positive minimum; if you want "no preference", just
     *  don't implement the trait). */
    readonly requiredHz: number;
}

/**
 * Structural guard for `IHasSampleRateRequirement`. True when the
 * object exposes a positive, finite `requiredHz` number. The
 * SimGraphNode uses this to filter inner-graph leaves before taking
 * the max.
 */
export function hasSampleRateRequirement(node: unknown): node is IHasSampleRateRequirement {
    if (!node || typeof node !== "object") return false;
    const n = node as Partial<IHasSampleRateRequirement>;
    return typeof n.requiredHz === "number" && Number.isFinite(n.requiredHz) && n.requiredHz > 0;
}

// =====================================================================
// Solver attachment (F3 — marker-node pattern)
// =====================================================================

/**
 * Diagnostic report returned by `ISolver.step(dt, session)`. Surfaced
 * by the marker node as viewables so the user can see solver behaviour
 * live (acceptance rate, rhs cost, error envelope) without instrumenting
 * the solver code paths.
 */
export interface ISolverStep {
    /** Absolute sim-time at the END of this macro-step. */
    readonly t: number;
    /** Number of internal adaptive micro-steps used to cover this macro
     *  step. 1 means no subdivision; higher means the solver detected
     *  stiffness or fast transients and refined. */
    readonly microSteps: number;
    /** L∞ (max) error estimate over the accepted state vector. Useful
     *  to compare against the configured tolerance. */
    readonly maxError: number;
    /** Total rhs evaluations performed across all micro-steps. For
     *  RK4 Cash-Karp ≈ 6 per accepted step + 6 per rejected attempt. */
    readonly rhsEvals: number;
}

/**
 * A continuous-time integrator attached to a Session. Owns its own
 * state vector, walks IIntegrable leaves, and advances them between
 * dispatch-phase fire-loops. The solver is a SESSION concern, not a
 * graph node — its lifecycle is initialize / step / dispose, never
 * fire().
 *
 * Multiple solvers can coexist on the same Session (split by leaf
 * typeId glob): an RK4 for fast non-stiff motors + a Rosenbrock for
 * stiff Sabatier chemistry, with disjoint leaf subsets. The integration
 * phase runs them in attachment order.
 */
export interface ISolver {
    /** Human-readable solver name (e.g. "RK4 Cash-Karp adaptive"). */
    readonly name: string;

    /** True if this solver consumes IIntegrable.jacobian when present.
     *  Explicit solvers (RK4) ignore it; implicit / stiff solvers use it
     *  for the Newton iteration. The marker node may surface this so a
     *  user picking between solvers sees which leaves benefit. */
    readonly supportsJacobian: boolean;

    /**
     * Hook the solver to a session-aware leaf set. Caches each leaf's
     * offset in the solver's private state vector and seeds y from each
     * leaf's `gatherState`. Called once per session lifecycle, from the
     * marker node's `reset()`.
     */
    initialize(leaves: ReadonlyArray<IIntegrable>, t0: number): void;

    /**
     * Advance the owned state vector from the previous accepted-step's
     * sim-time by exactly `dt`. May internally subdivide (adaptive
     * micro-stepping). At the END of step: every leaf's local state is
     * up-to-date via `writeState`. Reads upstream port values via the
     * session's link state (snapshot once per macro-step per Q1.2).
     *
     * Returns the diagnostic report for this macro-step.
     */
    step(dt: number, session: ISession): ISolverStep;

    /**
     * Last completed step's diagnostic report. The marker node exposes
     * this via `@viewable` so the property panel mirrors solver
     * behaviour in real time. `null` before the first `step()`.
     */
    readonly lastStep: ISolverStep | null;

    /**
     * Release any resources allocated during initialize (typed-array
     * buffers, Jacobian workspaces, etc.). Called by `Session.detachSolver`
     * AND by the marker node's `dispose`.
     */
    dispose?(): void;
}
