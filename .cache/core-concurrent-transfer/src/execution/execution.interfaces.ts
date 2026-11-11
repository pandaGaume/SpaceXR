import { IEnabled, IGraph, INode, IOlink } from "../graph/graph.interfaces";
import type { SceneStateView } from "../sim/scene-state-view.interface";
import type { IUnitExpectation } from "../math/math.units";

/**
 * Execution layer. Reuses the topology of core/graph (INode, IOlink,
 * IGraph) and adds only what the execution semantic requires: a per-
 * node contract (isReady/fire/reset), per-link routing metadata (slot,
 * delayed), and per-session state.
 *
 * Model: KPN/dataflow. Edges carry tokens; nodes fire when their
 * required inputs are ready; the scheduler dispatches per cycle.
 * Single-slot per channel in v1 (one unread token at most); FIFO/
 * multi-token deferred to the SNN milestone. Phase is sim-specific
 * (see core/sim/sim.interfaces); execution itself knows nothing of it.
 */

// =====================================================================
// Per-link runtime metadata
// =====================================================================

/**
 * Oriented link (inherits oini/ofin from IOlink) with execution
 * metadata.
 *
 * Two slot names live on each channel because a UE5-style editor may
 * connect ports whose names differ across the two endpoints (e.g.
 * Start._started → Branch.in):
 *
 *   - slot   names the OUTPUT port on the source node. Source-side
 *            code (a node iterating its own `onsc()` to decide which
 *            output a link belongs to, e.g. publishControlOutput,
 *            StartNode.fire) matches against this field.
 *   - toSlot names the INPUT port on the destination node. Destination-
 *            side code (resolveSlotInputs, processControlInputs scanning
 *            `opsc()`, the static required-inputs counter) matches
 *            against this field. Defaults to `slot` when omitted, so
 *            graphs whose source and destination ports share a name
 *            (most production samples) keep their existing semantics
 *            untouched.
 *
 * delayed channels are pre-seeded with initialValue at session reset,
 * so the target reads the initial token on its first cycle. Used to
 * break feedback cycles in DAG-topology graphs (FOC reading machine
 * state from t-1).
 */
export interface IChannel<T = unknown> extends IOlink, IEnabled {
    readonly slot: string | number;
    readonly toSlot?: string | number;
    readonly delayed: boolean;
    readonly initialValue?: T;
    /**
     * Optional per-link delivery policy. `Session.publish` invokes it once
     * before queueing the event. Specialized channels can transform a token,
     * schedule it for a future integer tick, or reject it by returning null.
     * Generic channels omit the hook and preserve the existing fast path.
     */
    prepareDelivery?(value: T, session: ISession): IChannelDelivery<T> | null;
}

export interface IChannelDelivery<T = unknown> {
    readonly value: T;
    readonly validAtTick?: number;
}

/**
 * Resolve the destination-side slot name of a channel. Returns
 * `toSlot` when set, otherwise falls back to `slot` so legacy
 * channels (where source and destination share the name) keep
 * working unchanged.
 */
export function inSlotOf(link: IChannel): string | number {
    return link.toSlot !== undefined ? link.toSlot : link.slot;
}

// =====================================================================
// Node execution contract
// =====================================================================

/**
 * A graph node with an execution contract. Reuses INode for topology
 * (id, position, onsc(), opsc()) and adds the dataflow lifecycle:
 *
 *   isReady(session)        true when this node may fire in the current
 *                           session cycle. Default semantic: every
 *                           required input slot has its bound channel
 *                           marked ready in the session's linkStates.
 *
 *   fire(session, t)        consume inputs, produce outputs (read/write
 *                           session.linkStates of bound channels). The
 *                           scheduler does not transport data; the node
 *                           decides what to peek vs consume.
 *
 *   reset(session)          drop any per-node session state. Called
 *                           when the session is reset.
 *
 *   createNodeState()       optional factory: when present, the Session
 *                           constructor calls it to allocate the node's
 *                           entry in session.nodeStates. Used by nodes
 *                           that need more than the base INodeState
 *                           (e.g. a sub-graph stores its internal
 *                           Session in IGraphNodeState).
 *
 * A single IRuntimeNode instance is safely shared by N parallel
 * sessions; all mutable state lives in the session's nodeStates entry
 * for this node.
 */
export interface IRuntimeNode<B = unknown> extends INode<B>, IEnabled {
    /** Opt-in concurrent async firing; the native traversal owns its lifetime. */
    readonly asyncMode?: "blocking" | "concurrent";
    isReady(session: ISession): boolean;
    fire(session: ISession, t: number): void;
    /**
     * Async variant of fire(). Nodes whose execution is genuinely
     * synchronous (most pure compute kernels) inherit the default
     * RuntimeNode implementation, which simply awaits fire(). Nodes
     * that wrap real async work (GPU, WebWorker, ONNX runtime) override
     * to await their async primitive instead. RuntimeGraph.runAsync
     * calls fireAsync uniformly without runtime introspection.
     */
    fireAsync(session: ISession, t: number): Promise<void>;
    reset(session: ISession): void;
    createNodeState?(): INodeState;

    /**
     * Optional pre-fire control-plane processing. The scheduler calls
     * this immediately before `fire(session, t)`. Implementations read
     * incoming control channels (slots prefixed with "_": _enable,
     * _start, _stop), update the node's lifecycle state accordingly,
     * and may publish on outgoing control channels (_enabled, _started,
     * _stopped) to broadcast the change. Returns nothing; mutation
     * happens on the node and on session linkStates.
     */
    processControlInputs?(session: ISession): void;
}

// =====================================================================
// Graph
// =====================================================================

/**
 * Execution mode for a runtime graph, declared explicitly at construction.
 *
 * Static: precomputed topological order over the non-delayed channel
 * subgraph, executed in one batched pass per cycle. Cheapest. Valid only
 * when (i) the non-delayed subgraph is acyclic, (ii) every active node
 * fires unconditionally each cycle.
 *
 * Dynamic: ready-queue dispatch. Per cycle, repeatedly select nodes
 * whose isReady() is true and fire them until quiescence. Handles cycles
 * (broken by delayed channels), threshold-driven nodes (SNN), external-
 * input pacing.
 *
 * The helper checkStaticEligible(graph) verifies the declared mode is
 * appropriate for the built graph.
 */
export type SchedulingMode = "static" | "dynamic";

// =====================================================================
// Lifecycle (start/stop) contract
// =====================================================================
//
// start / stop / status is a RUNTIME concern (whether an engine is on
// or off), not graph structure, so it lives here rather than in
// core/graph/graph.interfaces.

/**
 * Lifecycle states for an IRunnable model object. Transitions move
 * idle/stopped → starting → started → stopping → stopped, with failed
 * reachable from any starting/stopping transition on error.
 */
export type RunStatus = "idle" | "starting" | "started" | "stopping" | "stopped" | "failed";

/**
 * UI hint for IRunnable presentation. Editors map "play" to a green
 * start triangle and "record" to a pulsing red circle, with matching
 * tooltip vocabulary ("Start"/"Stop" vs "Record"/"Stop recording").
 * Absent or unrecognised values default to "play".
 */
export type RunnableAffordance = "play" | "record";

export const RunnableAffordanceMetadataKey = Symbol.for("spikypanda.runnableAffordance");

/**
 * Class decorator that tags an IRunnable implementation with a UI
 * affordance hint. The value is constant per class (every instance of
 * a recorder is a recorder), so the declaration lives at class scope:
 *
 *     @runnableAffordance("record")
 *     class DatasetCapture implements IRunnable { ... }
 *
 * Editors read the tag via getRunnableAffordance(); models without a
 * decorator (and without an inline affordance field) default to "play".
 */
export function runnableAffordance(value: RunnableAffordance): ClassDecorator {
    return (target) => {
        Reflect.defineMetadata(RunnableAffordanceMetadataKey, value, target);
    };
}

/**
 * Resolve the UI affordance of a runnable target. Instance fields take
 * precedence over class-level decorator metadata so ad-hoc data objects
 * can still override without subclassing. Unknown values fall back to
 * "play".
 */
export function getRunnableAffordance(target: object): RunnableAffordance {
    const inline = (target as Partial<IRunnable>).affordance;
    if (inline === "play" || inline === "record") {
        return inline;
    }
    const ctor = (target as { constructor?: new (...args: unknown[]) => unknown }).constructor;
    if (ctor) {
        const meta = Reflect.getMetadata(RunnableAffordanceMetadataKey, ctor);
        if (meta === "play" || meta === "record") {
            return meta;
        }
    }
    return "play";
}

/**
 * Lifecycle contract for a model object whose activity can be started
 * and stopped. start/stop may be sync or async; observers watch status
 * transitions through the bearer's onPropertyChanged (property name
 * "status").
 *
 * Distinct from the per-tick driver previously called IRunnable, which
 * was renamed to ITickable.
 */
export interface IRunnable {
    readonly status: RunStatus;
    /**
     * Optional inline override for the editor presentation hint.
     * Preferred declaration site is the @runnableAffordance class
     * decorator; this field is kept on the interface only for ad-hoc
     * data objects that have no class to decorate.
     */
    readonly affordance?: RunnableAffordance;
    start(): void | Promise<void>;
    stop(): void | Promise<void>;
}

/**
 * Type guard for IRunnable.
 */
export function isRunnable(obj: unknown): obj is IRunnable {
    if (typeof obj !== "object" || obj === null) {
        return false;
    }
    const candidate = obj as Partial<IRunnable>;
    return typeof candidate.status === "string" && typeof candidate.start === "function" && typeof candidate.stop === "function";
}

/**
 * Per-tick autonomous-drive contract. A graph that is ITickable can
 * drive itself without the caller having to construct a Session
 * explicitly: it lazily allocates a default Session whose state persists
 * across run() calls (so delayed channels and counters survive between
 * ticks). Callers that need explicit Session control (concurrent
 * inferences, custom state lifecycle) pass their own Session via the
 * optional second parameter, in which case the default session is
 * bypassed entirely.
 *
 * The default Session is an implementation detail and is intentionally
 * not part of this contract.
 *
 * Distinct from IRunnable (the start/stop lifecycle contract defined
 * above): ITickable is one cycle of work; IRunnable is the higher-level
 * "is the engine on or off" state.
 */
export interface ITickable {
    run(t: number, session?: ISession): void;
    runAsync(t: number, session?: ISession): Promise<void>;
}

/**
 * Runtime graph: an IGraph of IRuntimeNode + IChannel that is itself an
 * IRuntimeNode (composition fractale).
 *
 * Embedding: when this graph is wired as a node inside a parent graph,
 * the parent treats it like any other IRuntimeNode (channels target it
 * with a slot, isReady/fire follow the standard contract). Routing
 * across the boundary uses the slot vocabulary directly:
 *
 *   external slot of a channel feeding this graph
 *     -> internal channel whose oini is null and whose slot matches
 *        (the sub-graph's input "port" for that slot name)
 *     -> internalSession.linkStates[idx]         (write payload)
 *
 *   external slot of a channel leaving this graph
 *     -> internal channel whose ofin is null and whose slot matches
 *        (the sub-graph's output "port" for that slot name)
 *     -> internalSession.linkStates[idx]         (read payload)
 *
 * Port channels are simply channels created with a dangling endpoint
 * (oini undefined for inputs, ofin undefined for outputs); their slot
 * names define the public interface of the sub-graph. No separate
 * binding map is required.
 *
 * Top-level use (no parent embedding): port channels are never
 * matched; the user drives via `new Session(graph)` as usual.
 */
export interface IRuntimeGraph<N extends IRuntimeNode = IRuntimeNode, L extends IChannel = IChannel> extends IGraph<N, L>, IRuntimeNode, ITickable {
    readonly mode: SchedulingMode;
}

// =====================================================================
// Per-session state
// =====================================================================

/**
 * Per-channel state in a session — a backward-compatibility VIEW over
 * the destination node's per-slot input buffer.
 *
 *   ready   true when the destination node has at least one un-consumed
 *           token on this channel's incoming slot.
 *   payload the head of the destination's per-slot buffer (next value
 *           that will be returned by `consume`). undefined when ready
 *           is false.
 *
 * Historically this was a 1-slot store; today the actual storage lives
 * on the destination node (per `INodeState.inputBuffers`) and supports
 * an arbitrary-capacity FIFO so loops can publish bursts without losing
 * intermediate values. The ILinkState surface is preserved so existing
 * nodes that probe `linkStates[idx].ready` keep working unchanged.
 */
export interface ILinkState<T = unknown> {
    ready: boolean;
    payload: T | undefined;
}

/**
 * Per-node state in a session.
 *
 *   inputBuffers   one FIFO queue per incoming slot, keyed by the slot
 *                  name (toSlot of the channel feeding that slot).
 *                  Publish appends; consume shifts. Capacity is bounded
 *                  by the source port descriptor; overflow throws.
 *   inputCapacity  per-slot max queue size. Defaults to 1 for slots not
 *                  declared elsewhere.
 *   linksReady     count of incoming gating slots whose buffer is
 *                  currently non-empty. Maintained on publish/consume
 *                  transitions so the scheduler can dispatch in O(1)
 *                  per check. The node is dispatch-eligible when this
 *                  reaches `requiredInputsOf(node)`.
 *
 * Extensible: nodes that need richer per-session state declare a
 * createNodeState() factory and return a subtype. A sub-graph node, for
 * example, stores its internal Session as IGraphNodeState.internalSession.
 */
export interface INodeState {
    linksReady: number;
    inputBuffers?: Map<string | number, unknown[]>;
    inputCapacity?: Map<string | number, number>;
    /**
     * Signal-kind input storage: current value per slot, overwrite-on-
     * publish, no drain, no overflow. Populated by `Session.publish`
     * when the destination port descriptor declares `kind: "signal"`.
     * Read back via `Session.readSignal(channelIndex)`. Independent
     * of the stream-kind path (`inputBuffers`); a single node may mix
     * both kinds across its slots.
     */
    inputSignals?: Map<string | number, unknown>;
}

/**
 * Scheduler queue items. A LinkRef is the publish-event carrier (link
 * index + the value being delivered); IRuntimeNode entries represent
 * a node ready-check. The drain loop alternates between them.
 *
 * `validAtTick` (optional): the integer scheduler tick INDEX at which
 * this event becomes deliverable. Compared against `ISession.tickIndex`
 * (NOT `currentTick`, which holds continuous sim-time t). Events with
 * `validAtTick > session.tickIndex` are deferred — they sit in a side
 * queue and re-enter the main queue at the run where `tickIndex`
 * reaches them. Generalises the legacy "delayed channel pre-seed"
 * mechanism: any node can stamp any publish with a future tick index,
 * enabling Z⁻ᴺ delays (FeedbackChannel), scheduled-message agents,
 * watchdog timeouts, etc. Without this field events are delivered
 * immediately (legacy behaviour).
 */
export interface ILinkRef {
    readonly kind: "linkRef";
    readonly linkIndex: number;
    readonly value: unknown;
    readonly validAtTick?: number;
}

export function isLinkRef(item: ILinkRef | IRuntimeNode): item is ILinkRef {
    return (item as ILinkRef).kind === "linkRef";
}

/**
 * Per-node state for a graph that is embedded as a node in a parent.
 * The internalSession is the per-parent-session instance that drives
 * this sub-graph's internal scheduler. One parent session has its own
 * IGraphNodeState (and therefore its own internalSession) per embedded
 * graph node, so a single IRuntimeGraph instance can be shared across N
 * parents without collision.
 */
export interface IGraphNodeState extends INodeState {
    internalSession: ISession;
}

/** Optional scope for a static traversal on the existing session graph. */
export interface IStaticRunOptions {
    readonly nodes?: ReadonlySet<IRuntimeNode>;
}

/**
 * Per-execution state container. Owns the link/node state arrays for
 * one inference/tick lineage, exposes the input/output entry points and
 * the drive API (run, reset). Sim extends with ISimSession (currentPhase);
 * other domains can extend with their own per-session fields without
 * touching this base.
 */
export interface ISession {
    /** Native queue wakeup used while concurrent async nodes are pending. */
    onWorkAvailable?(listener: () => void): () => void;
    /** Awaitable delivery boundary; implementations retain session-owned buffers. */
    deliverLinkRefsAsync?(refs: readonly ILinkRef[], t: number): Promise<void>;
    readonly graph: IRuntimeGraph;
    readonly linkStates: ReadonlyArray<ILinkState>;
    readonly nodeStates: ReadonlyArray<INodeState>;

    /**
     * Simulation sample rate in Hz (0 = unknown / free-running). Set by
     * the host runtime so nodes can read an authoritative value without
     * being configured per-instance. See `Session.simRate` for full doc.
     */
    simRate: number;

    /**
     * True while the host runtime is actively driving `run(t)` calls.
     * Set by the host (e.g. GraphRunner) on play()/pause()/stop() — the
     * Session does not flip this on its own. Lets nodes that care about
     * the host-level lifecycle (UI tiles wanting "view-only during play",
     * recorders gated on play state, ...) read a single authoritative
     * flag without subscribing to runner events.
     *
     * Idle (no session yet) ↔ field doesn't exist (session is null).
     * Playing                ↔ true.
     * Paused / stopped       ↔ false.
     */
    running: boolean;

    /**
     * Most recent sim-time `t` the session was driven with via
     * `run(t)`. CONTINUOUS, in seconds (or whatever unit the host
     * driver uses). Initialised to -Infinity before the first run.
     * NOT the same thing as `tickIndex` — `currentTick` is the
     * sim-time clock, `tickIndex` is the scheduler-call counter.
     * `dt = currentTick - lastT` gives the continuous time elapsed
     * since the previous run, used by IIntegrable solvers.
     *
     * Misnamed historically (`tick` suggesting integer count, but the
     * field holds the continuous t); kept as-is for API stability.
     * For integer-counted scheduling delays (Z⁻ᴺ FeedbackChannel),
     * use `tickIndex` instead — see `ILinkRef.validAtTick`.
     */
    readonly currentTick: number;

    /**
     * Integer scheduler-call counter. Starts at 0, increments by 1
     * each time `run(t)` is invoked. Stays integer regardless of how
     * the host advances sim-time (fixed-step, free-running, irregular
     * batches). The right index for tick-relative scheduling: a
     * Z⁻ᴺ delay node stamps `validAtTick = tickIndex + N` so the
     * event resurfaces exactly N runs later, regardless of how big
     * each macro-step's `dt` happens to be.
     */
    readonly tickIndex: number;

    /**
     * Previous tick — the value of `currentTick` from the most recent
     * `run(t)` call BEFORE the current one started. Together with
     * `currentTick` this gives `dt = currentTick - lastT`. Initialised
     * to -Infinity so the first `run(0)` sees `dt === Infinity` (the
     * caller treats that as "first tick, no meaningful dt available").
     *
     * Stateful non-IIntegrable nodes (PI controllers, low-pass
     * filters, tachymeters) read `dt` from the session instead of
     * pulling a `dt` input port — the dt is a property of the
     * scheduling, not of the data graph.
     */
    readonly lastT: number;

    /**
     * Sim-time elapsed since the previous `run(t)`. Computed as
     * `currentTick - lastT` at the start of each `run`. Returns
     * `+Infinity` before the first run AND on the very first run
     * (because `lastT` is still -Infinity at that point); nodes that
     * care about this case must clamp / treat first-tick specially.
     *
     * The Session owns this value so IIntegrable solvers AND non-
     * IIntegrable stateful nodes all read from a single source of
     * truth — no more per-node `_lastT` mirroring, no more `dt`
     * input ports threading the same scalar through the data graph.
     */
    readonly dt: number;

    /**
     * Solvers attached to this session via `attachSolver`. Their
     * `step(dt, session)` is called in attachment order at the start
     * of every `run(t)` (the "integration phase"), BEFORE the
     * scheduler's dispatch phase. By the time a leaf's `fire()` runs,
     * any solver that owns it has already updated its state, so the
     * leaf's `fire()` becomes pure I/O (read state, publish outputs).
     */
    readonly solvers: ReadonlyArray<ISolverHandle>;

    /**
     * Register a solver with this session. The solver's `step(dt,
     * session)` will be invoked at the start of each `run(t)` call.
     * Multiple solvers may coexist (typically split by leaf subset via
     * the marker node's `leafFilter`); execution order matches
     * attachment order. Idempotent: re-attaching an already-attached
     * solver instance is a no-op.
     */
    attachSolver(solver: ISolverHandle): void;

    /**
     * Unregister a previously-attached solver. Calls the solver's
     * `dispose?()` if defined. No-op when the solver isn't currently
     * attached. The marker node typically calls this from its own
     * `dispose()` or when it rebuilds the solver instance on a config
     * change mid-session.
     */
    detachSolver(solver: ISolverHandle): void;

    /**
     * Scene-state binding for this session.
     *
     * - `Sim.Graph` nodes set their `innerSession.sceneStateView` at
     *   `reset(parentSession)` by reading the wired `SceneItem` and
     *   building a `SceneStateView` from it.
     * - `GraphRunner` sets the root session's `sceneStateView` to the
     *   primary `SceneItem` at the root canvas (the one with
     *   `isPrimary === true`, or the sole one if there is only one).
     * - When no scene is wired anywhere, the runtime falls back to a
     *   default view (Earth gravity, 20 °C, identity transform).
     *
     * Consumers (TransformNode-derived nodes, future gates, sensors)
     * read this once at session bind and cache the reference; the
     * view's getters are live, so subsequent reads see fresh values
     * even though the reference is stable.
     *
     * Nullable in the interface so an implementation may set it
     * lazily; consumers should handle the null case by falling back
     * to a default view of their own.
     */
    sceneStateView: SceneStateView | null;

    /**
     * Inject a value into a channel from outside the graph. Equivalent
     * to publish() but named for clarity at the caller boundary
     * (feeding a model-input channel before a run).
     */
    setInput(channelIndex: number, value: unknown): void;

    /**
     * Read the current payload of a channel without consuming it.
     * Equivalent to peek() but named for clarity at the caller boundary
     * (reading a model-output channel after a run).
     */
    getOutput(channelIndex: number): unknown;

    /**
     * Node-side write API: set payload + ready=true on the channel.
     * When this transitions the channel from not-ready to ready and
     * the channel is enabled, the destination node's INodeState
     * .linksReady is bumped by 1. The ready-queue scheduler uses this
     * counter to dispatch downstream nodes without rescanning the
     * graph; nodes that mutate linkStates directly bypass that
     * accounting and must update counters themselves (not recommended).
     *
     * `opts.validAtTick` schedules the value for a future sim tick.
     * Until that tick is reached the event sits in a deferred queue
     * (no buffer push, no linksReady bump) and is promoted to the
     * main queue when `session.run(t)` is called with `t >= validAtTick`.
     * Default = undefined → deliver immediately as before.
     */
    publish(channelIndex: number, value: unknown, opts?: { validAtTick?: number }): void;

    /**
     * Node-side read+clear API: returns the payload and clears the
     * channel (ready=false, payload=undefined). When the channel was
     * ready and is enabled, decrements the destination node's
     * INodeState.linksReady so it can re-arm on the next publish.
     */
    consume(channelIndex: number): unknown;

    /**
     * Node-side read API for SIGNAL-kind channels: returns the current
     * value (last published) without modifying anything. Returns
     * `undefined` if nothing has been published yet OR if the channel
     * is a stream-kind (in which case the value lives in the buffer,
     * not the signal store). Use this from a leaf's `fire()` or a
     * solver's rhs when reading continuous-value inputs (V, omega,
     * setpoints, observations) — the right pattern for ZOH semantics.
     */
    readSignal(channelIndex: number): unknown;

    /**
     * Node-side read API: returns the payload without clearing the
     * channel. Use for SNN-style integration where a node reads its
     * input but does not consume it (so the next tick still sees the
     * same value).
     */
    peek(channelIndex: number): unknown;

    /**
     * Number of enabled incoming channels (filtered to channels that
     * belong to this session's graph) for the given node. Cached at
     * session construction; treat as immutable per session. The
     * scheduler dispatches a node when its INodeState.linksReady
     * reaches this count.
     */
    requiredInputsOf(node: IRuntimeNode): number;

    /**
     * Lookup helper: per-node session state for a given node. Returns
     * undefined when the node is not part of this session's graph.
     * Used by nodes that need to read/write their own state without
     * tracking their index manually.
     */
    nodeStateOf(node: IRuntimeNode): INodeState | undefined;

    /**
     * Lookup helper: per-link session state for a given channel.
     * Returns undefined when the channel is not part of this session's
     * graph.
     */
    linkStateOf(channel: IOlink): ILinkState | undefined;

    run(t: number): void;
    /** Await async nodes using this graph's native scheduling mode. */
    runAsync(t: number): Promise<void>;
    reset(): void;

    /**
     * Begin-Play entry point: arms every StartNode in the graph so it
     * fires on the next run(t) and broadcasts a trigger on its _started
     * output. Symmetric stop() arms every StopNode (when introduced).
     * Implementations no-op on graphs that have neither.
     */
    start(): void;
    stop(): void;
}

// =====================================================================
// Analysis helpers
// =====================================================================

/**
 * Result of static-eligibility analysis. eligible=true means the graph
 * can be safely scheduled in "static" mode; reasons is empty.
 * eligible=false populates reasons with one entry per blocker (cycle
 * through non-delayed channels, node with conditional readiness, ...).
 */
export interface IStaticEligibility {
    readonly eligible: boolean;
    readonly reasons: ReadonlyArray<string>;
}

// =====================================================================
// Optional editor metadata
// =====================================================================

/**
 * Opt-in interface for nodes that want to declare their port schema
 * statically, independent of the channels currently wired to them.
 * Consumed by the editor (to render unconnected ports like Conv.B
 * before any link is attached) and by validators. The runtime itself
 * ignores this; ports at runtime are derived from onsc()/opsc().
 */
export interface IDeclaresPorts {
    readonly inputPorts: ReadonlyArray<IPortDescriptor>;
    readonly outputPorts: ReadonlyArray<IPortDescriptor>;
}

/**
 * Minimal interface a Session needs to drive an integrator: just a
 * `step(dt, session)` entry point and an optional cleanup hook. Kept
 * deliberately spartan at the execution layer so we don't drag the
 * sim package's IIntegrable / Float64Array machinery up into the
 * topology / scheduler core (which would create a circular import:
 * sim depends on execution.interfaces).
 *
 * The full `ISolver` interface in `packages/dev/core/src/sim/` extends
 * this handle with `name`, `supportsJacobian`, `initialize(leaves,
 * t0)`, and `lastStep` diagnostics — the marker node and concrete
 * solver impls type against the richer ISolver; the Session only
 * needs ISolverHandle to schedule the integration phase.
 */
export interface ISolverHandle {
    /**
     * Advance whatever state this handle owns by `dt`. The session is
     * passed so the implementation can read upstream linkStates (the
     * solver's per-leaf rhs needs them). Returns diagnostic counters
     * the marker node surfaces as viewables.
     */
    step(
        dt: number,
        session: ISession
    ): {
        readonly t: number;
        readonly microSteps: number;
        readonly maxError: number;
        readonly rhsEvals: number;
    };

    /**
     * Re-read the owned leaves' state into the solver's own vector and
     * rewind its clock to `t0`. A solver seeds its state once, at
     * initialize; a session reset that restores the leaves' initial
     * conditions (or a run that changed an initial state after the
     * solver was attached) must call this, or the next macro-step writes
     * the stale vector back over the fresh state. Optional: a handle
     * without state has nothing to re-read.
     */
    reseed?(t0: number): void;

    /** Release private buffers / workspaces. Optional. */
    dispose?(): void;
}

export interface IPortDescriptor {
    readonly slot: string | number;
    readonly optional: boolean;
    readonly type?: string;
    /**
     * Optional declared unit expectation (wiring-time contract): the
     * physical quantity (+ optional exact unit) this port expects or
     * produces. The GraphBuilder can validate it like it validates
     * shapes; `requires: true` means the port refuses an untagged tensor.
     * See docs/architecture/unit-tag-convention.md.
     */
    readonly unit?: IUnitExpectation;
    readonly multiplicity?: "single" | "variadic";
    /**
     * Maximum number of un-consumed tokens this port may accumulate in
     * its per-session FIFO buffer. Defaults to 1, which matches the
     * historical 1-slot semantics (each publish on this port either
     * fits the buffer or throws an overflow error). Loop / accumulator
     * nodes raise this to allow N tokens to queue before downstream
     * consumes them.
     */
    readonly capacity?: number;
    /**
     * Editor-only routing hint for split-view nodes: which visual
     * anchor (widget) the port should render on. Default undefined →
     * routes to anchor 0 (the single widget of an ordinary node). The
     * runtime ignores this field — it never affects scheduling, only
     * the per-port DOM placement when the host's NodeUI honours
     * `anchorCount` on the NodeMeta. See `NodeUI` and `PortDef` in
     * @spiky-panda/nodeeditor for the rendering side.
     */
    readonly anchor?: number;

    /**
     * Scheduler gating flag. Default true (legacy behaviour). When set
     * to `false`, this input port does NOT count toward the node's
     * `requiredInputs` total: the scheduler will fire this node every
     * tick regardless of whether the port's buffer happens to hold a
     * token at the moment of the readiness check.
     *
     * SUPERSEDED by the `kind: "signal"` semantic — keep for backward
     * compatibility and for nodes that want stream semantics with the
     * gating-off hack. New code should use `kind: "signal"` instead.
     */
    readonly gating?: boolean;

    /**
     * Port semantic kind: how the framework treats values flowing on
     * channels attached to this port.
     *
     *   "stream" (default) — DISCRETE EVENTS. Each publish appends a
     *     token onto a per-slot FIFO buffer at the destination. Each
     *     consume drains one token. Buffers count toward the
     *     destination's `requiredInputs` gating. Overflow throws.
     *     Required for burst semantics (Logic.Loop body, Sequence
     *     then_N, edge triggers, control plane events).
     *
     *   "signal" — CONTINUOUS VALUES (zero-order hold). Each publish
     *     OVERWRITES a single "current value" slot at the destination.
     *     Each read returns that current value (no drain). No buffer,
     *     no overflow, no gating: a destination node with only signal
     *     inputs fires every tick. Default value before any publish is
     *     `undefined` (reader's job to handle).
     *
     * Most data-flow edges in a control-system sim are SIGNALS:
     * voltage, current, omega, setpoints, observations, fault levels.
     * Discrete events like triggers / loop iterations stay STREAMS.
     *
     * The dest-port kind drives the publish path. Source-port kind
     * is descriptive; the dest decides storage. When two compatible
     * ports of different kinds connect, the dest kind wins.
     */
    readonly kind?: "stream" | "signal";
}

export function declaresPorts(n: IRuntimeNode): n is IRuntimeNode & IDeclaresPorts {
    const candidate = n as IRuntimeNode & Partial<IDeclaresPorts>;

    return Array.isArray(candidate.inputPorts) && Array.isArray(candidate.outputPorts);
}

/**
 * Sister of IDeclaresPorts for the runtime control plane. Kept distinct
 * from inputPorts/outputPorts so the editor can render the two groups
 * differently (e.g., compact row at the top/bottom of the node body) and
 * so validators know which slots correspond to lifecycle wiring vs.
 * domain data. Slot names by convention start with "_" (see
 * control-ports.ts).
 *
 * Every RuntimeNode satisfies this with at least { _enable, _enabled }.
 * RunnableNode adds { _start, _stop, _started, _stopped }. Subclasses
 * compose further if they need more (e.g. _pause, _reset).
 */
export interface IDeclaresControlPorts {
    readonly controlInputPorts: ReadonlyArray<IPortDescriptor>;
    readonly controlOutputPorts: ReadonlyArray<IPortDescriptor>;
}

export function declaresControlPorts(n: IRuntimeNode): n is IRuntimeNode & IDeclaresControlPorts {
    const candidate = n as IRuntimeNode & Partial<IDeclaresControlPorts>;
    return Array.isArray(candidate.controlInputPorts) && Array.isArray(candidate.controlOutputPorts);
}
