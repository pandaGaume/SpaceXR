import { IOlink } from "../graph/graph.interfaces";
import type { SceneStateView } from "../sim/scene-state-view.interface";
import { isControlSlot } from "./control-ports";
import { IChannel, ILinkRef, ILinkState, INodeState, IRuntimeGraph, IRuntimeNode, ISession, ISolverHandle, inSlotOf } from "./execution.interfaces";
import { Scheduler } from "./execution.scheduler";
import { StartNode } from "./start.node";
import { StopNode } from "./stop.node";

type DeclaredPort = { slot: string | number; gating?: boolean; kind?: "stream" | "signal" };

/** A slot's family: `delta_CO2_3` and `delta_CO2_0` are one family, the variadic pool an editor grows by index. */
const slotFamily = (slot: string | number): string => String(slot).replace(/_?\d+$/, "");

/**
 * The declared input port a channel lands on: the one with the slot's
 * name, or, for a slot of a variadic pool the node declares by its first
 * index only (`delta_CO2_1` next to a declared `delta_CO2_0`), the one of
 * the same family. A channel into a pool keeps the pool's kind: a signal
 * pool does not gate, and does not turn into a stream nobody drains.
 */
function declaredPortFor(declared: ReadonlyArray<DeclaredPort> | undefined, slot: string | number): DeclaredPort | undefined {
    if (!declared) return undefined;
    const exact = declared.find((p) => p.slot === slot);
    if (exact) return exact;
    const family = slotFamily(slot);
    return declared.find((p) => typeof p.slot === "string" && slotFamily(p.slot) === family);
}

/**
 * Concrete ISession built on **per-node input buffers**.
 *
 * Each destination node owns one FIFO queue per incoming slot. A
 * `publish(linkIdx, value)` does NOT write into a per-channel slot;
 * it enqueues a `LinkRef { linkIndex, value }` onto the session's
 * scheduler queue. The scheduler drains the queue, alternating
 * between LinkRefs (which append the value into the destination's
 * slot buffer and queue the destination for a fire-check) and node
 * dispatches (which fire when every gating buffer is non-empty,
 * consuming exactly one token per slot per fire).
 *
 * The previous 1-slot `ILinkState` surface is kept as a derived view
 * (`linkStates` proxy), so existing nodes that probe
 * `session.linkStates[idx].ready` keep working transparently.
 *
 * Capacity per slot is sourced from the source port descriptor when
 * available (via {@link IRuntimeNode} declarations) and otherwise
 * defaults to 1, preserving historical 1-slot semantics for nodes that
 * have not been migrated to declare loop-friendly capacities.
 */
export class Session implements ISession {
    public readonly graph: IRuntimeGraph;
    public readonly nodeStates: INodeState[];

    /**
     * Scheduler work queue. Items are either LinkRefs (publish events
     * pending delivery) or IRuntimeNode (ready-check requests). Owned
     * by the Session so `publish()` can append while a node is firing.
     */
    public readonly queue: (ILinkRef | IRuntimeNode)[] = [];

    /**
     * Deferred publish events: LinkRefs stamped with `validAtTick` in
     * the future. Held here between ticks; promoted back into `queue`
     * at the start of each `run(t)` for events with `validAtTick <= t`.
     * Enables Z⁻ᴺ delay semantics (FeedbackChannel) and scheduled-
     * message patterns (timers, watchdogs) without per-node ring buffers.
     *
     * Kept unsorted — the promote scan is linear in deferred count, which
     * is bounded by the deepest delay any node has stamped. For a typical
     * closed-loop sim that's a handful of events per node × number of FB
     * channels, so linear is fine.
     */
    public readonly deferred: ILinkRef[] = [];

    /**
     * Most recent tick passed to `run(t)`. Used by the scheduler to
     * compare against each LinkRef's `validAtTick`. Initialised to
     * -Infinity so the very first publish with `validAtTick = 0` (or
     * any finite value) defers correctly until the first `run(0)`.
     */
    public currentTick: number = -Infinity;

    /**
     * Integer scheduler-call counter. Starts at 0, increments by 1 each
     * `run(t)` BEFORE the integration phase. Used by the deferred
     * queue's tick-based scheduling (FB Channel, Z⁻ᴺ delays) so the
     * comparison is integer arithmetic against `ILinkRef.validAtTick`
     * — independent of how fast or irregularly the host advances the
     * continuous `currentTick` (sim-time t).
     */
    public tickIndex: number = 0;

    /**
     * Previous value of `currentTick`. Together with `currentTick` lets
     * any node (or solver) read the elapsed sim-time via the `dt`
     * getter without maintaining its own `_lastT` mirror. Updated at
     * the start of each `run(t)`.
     */
    public lastT: number = -Infinity;

    /**
     * Solvers registered via `attachSolver`. Iterated at the start of
     * each `run(t)` to drive the integration phase BEFORE the dispatch
     * phase fires its first node. Order = attachment order = order in
     * which the marker nodes called `attachSolver` during reset().
     *
     * Held privately so external code can't reorder the array; the
     * read-only view is exposed via the `solvers` getter on ISession.
     */
    private readonly _solvers: ISolverHandle[] = [];

    /**
     * Simulation sample rate (Hz) the session is being driven at.
     * Set by the host runtime (e.g. GraphRunner in fixed-realtime mode)
     * after constructing the session, so nodes that need a stable
     * timebase (FFT analyzers, spectrum / waterfall viz tiles, control
     * loops with sampleRate-dependent coefficients) can read a single
     * authoritative value instead of being configured manually per node.
     *
     * 0 means "unknown / free-running" — consumers should fall back to
     * their default (bin-index axis for viz tiles, etc.). Non-zero
     * means every session.run(t) tick advances by exactly 1/simRate
     * seconds (the runner's fixed-step guarantee).
     */
    public simRate: number = 0;

    /**
     * Host-driven play-state flag (see ISession.running). The Session
     * never mutates this on its own — start()/stop() arm Start/Stop
     * nodes but do not touch `running`. The host runtime (GraphRunner)
     * owns the flag and flips it on play/pause/stop transitions.
     */
    public running: boolean = false;

    /**
     * Scene-state view this session is bound to (see
     * `ISession.sceneStateView`). Set by the host:
     *   - `Sim.Graph.reset()` writes its inner session's view from
     *     the wired SceneItem;
     *   - `GraphRunner` writes the root session's view from the
     *     primary SceneItem at the root canvas;
     *   - left null when no SceneItem participates in the session,
     *     in which case TransformNode-derived consumers fall back
     *     to their own default (Earth surface) rather than throw.
     */
    public sceneStateView: SceneStateView | null = null;

    private _required: number[];
    private _linkStatesProxy: ILinkState[];
    /**
     * Per-channel cache: true when the destination port declares
     * `kind: "signal"`. Computed once at construction; drives the
     * publish path (signal → direct write into `nodeState.inputSignals`,
     * stream → enqueue a LinkRef as before) and the readSignal helper
     * (signal → read map, stream → undefined). Indexed by linkIndex.
     */
    private _isSignalChannel: boolean[] = [];
    /**
     * Per-node flag: true when the node has NO wired inputs of any
     * kind (truly source-like, e.g. Slider / NumberConstant / Clock).
     * Such nodes are seeded at the start of every RunDynamic. Nodes
     * with wired signal inputs are NOT seeded — they wait for the
     * first signal write (which re-queues them via the standard
     * post-deliver re-queue path) so they fire AFTER their data has
     * arrived this tick, preserving topological order.
     *
     * Without this distinction, a node with required=0 (because all
     * its inputs are signals) would seed immediately and fire with
     * stale data, then never see the actual signal updates arrive.
     */
    private _isTrueSource: boolean[] = [];

    public constructor(graph: IRuntimeGraph) {
        this.graph = graph;
        this.nodeStates = graph.nodes.map((n) => {
            const base = typeof n.createNodeState === "function" ? n.createNodeState() : ({ linksReady: 0 } as INodeState);
            // Always materialise the buffer maps; createNodeState
            // subclasses may have omitted them.
            if (!base.inputBuffers) base.inputBuffers = new Map();
            if (!base.inputCapacity) base.inputCapacity = new Map();
            return base;
        });
        this._required = this._computeRequiredInputs();
        this._linkStatesProxy = this._buildLinkStatesProxy();
        this._populateCapacities();
        this._populateSignalKinds();
        this._populateTrueSourceFlags();
        this.reset();
    }

    /** Read-only accessor used by the scheduler to decide seeding. */
    public isTrueSource(node: IRuntimeNode): boolean {
        const idx = (this.graph.nodes as ReadonlyArray<IRuntimeNode>).indexOf(node);
        return idx >= 0 ? this._isTrueSource[idx] : false;
    }

    /**
     * Backwards-compatible view over the per-node input buffers. Each
     * entry exposes `{ ready, payload }` computed lazily from the
     * destination's buffer for that link's destination slot.
     */
    public get linkStates(): ReadonlyArray<ILinkState> {
        return this._linkStatesProxy;
    }

    public setInput(channelIndex: number, value: unknown): void {
        this.publish(channelIndex, value);
    }

    private readonly workListeners = new Set<() => void>();

    public onWorkAvailable(listener: () => void): () => void {
        this.workListeners.add(listener);
        return () => { this.workListeners.delete(listener); };
    }

    public getOutput(channelIndex: number): unknown {
        return this.peek(channelIndex);
    }

    /**
     * Enqueue a publish event onto the scheduler queue. The actual
     * buffer append happens when the LinkRef is dequeued, so the order
     * of effects within one outer drain stays FIFO across publishes
     * and downstream dispatches.
     *
     * When `opts.validAtTick` is set AND the target tick is strictly in
     * the future, the event is placed in the deferred queue instead. It
     * sits there across ticks until the runner calls `run(t)` with
     * `t >= validAtTick`; the next run promotes it to the main queue.
     * If `validAtTick <= currentTick` (or is omitted), behaviour matches
     * legacy immediate publish.
     */
    public publish(channelIndex: number, value: unknown, opts?: { validAtTick?: number }): void {
        const link = this._linkAt(channelIndex);
        let payload = value;
        let linkValidAt: number | undefined;
        if (link?.prepareDelivery) {
            const prepared = link.prepareDelivery(value, this);
            if (prepared === null) return;
            payload = prepared.value;
            linkValidAt = prepared.validAtTick;
        }
        const requestedValidAt = opts?.validAtTick;
        const validAt = requestedValidAt === undefined ? linkValidAt : linkValidAt === undefined ? requestedValidAt : Math.max(requestedValidAt, linkValidAt);
        const ref: ILinkRef =
            validAt !== undefined
                ? { kind: "linkRef", linkIndex: channelIndex, value: payload, validAtTick: validAt }
                : { kind: "linkRef", linkIndex: channelIndex, value: payload };
        // Defer when validAtTick is a future TICK INDEX (integer),
        // not a future sim-time. Holds for BOTH stream and signal
        // channels — a signal scheduled for tick N+2 is just a future
        // write to the signal store. The deferred queue promotes it
        // at the right tick and deliverLinkRef routes by kind.
        if (validAt !== undefined && validAt > this.tickIndex) {
            this.deferred.push(ref);
            return;
        }
        this.queue.push(ref);
        for (const listener of this.workListeners) listener();
    }

    /**
     * Read the current value of a signal-kind channel without modifying
     * anything. Returns `undefined` if nothing has been published yet,
     * the channel is disabled, OR the channel is a stream-kind (in
     * which case the data is in the buffer, not the signal store —
     * use `peek` / `consume` for streams).
     */
    public readSignal(channelIndex: number): unknown {
        if (!this._isSignalChannel[channelIndex]) return undefined;
        const link = this._linkAt(channelIndex);
        if (!link || !link.enabled) return undefined;
        const dst = link.ofin as IRuntimeNode | null;
        if (!dst) return undefined;
        const state = this.nodeStateOf(dst);
        const store = state?.inputSignals;
        if (!store) return undefined;
        const slot = inSlotOf(link);
        return store.get(slot);
    }

    /**
     * Pop the head of the destination's buffer for this channel.
     * Returns undefined when the buffer is empty. Maintains the
     * destination's `linksReady` counter on empty-transitions.
     */
    public consume(channelIndex: number): unknown {
        const link = this._linkAt(channelIndex);
        if (!link) return undefined;
        const buf = this._bufferFor(link);
        if (!buf || buf.length === 0) return undefined;
        const value = buf.shift();
        if (buf.length === 0) {
            this._onSlotEmptied(link);
        }
        return value;
    }

    /**
     * Read the head of the destination's buffer without consuming it.
     * Returns undefined when the buffer is empty.
     */
    public peek(channelIndex: number): unknown {
        const link = this._linkAt(channelIndex);
        if (!link) return undefined;
        const buf = this._bufferFor(link);
        if (!buf || buf.length === 0) return undefined;
        return buf[0];
    }

    public requiredInputsOf(node: IRuntimeNode): number {
        const idx = (this.graph.nodes as ReadonlyArray<IRuntimeNode>).indexOf(node);
        return idx >= 0 ? this._required[idx] : 0;
    }

    public nodeStateOf(node: IRuntimeNode): INodeState | undefined {
        const idx = (this.graph.nodes as ReadonlyArray<IRuntimeNode>).indexOf(node);
        return idx >= 0 ? this.nodeStates[idx] : undefined;
    }

    public linkStateOf(channel: IOlink): ILinkState | undefined {
        const idx = (this.graph.links as ReadonlyArray<IOlink>).indexOf(channel);
        return idx >= 0 ? this._linkStatesProxy[idx] : undefined;
    }

    public start(): void {
        for (const node of this.graph.nodes) {
            if (node instanceof StartNode) node.arm();
        }
    }

    public stop(): void {
        for (const node of this.graph.nodes) {
            if (node instanceof StopNode) node.arm();
        }
    }

    /**
     * Elapsed sim-time since the previous `run(t)`. Equal to
     * `currentTick - lastT`. Returns `+Infinity` before the first run
     * AND on the first run (because `lastT` is still -Infinity at that
     * point, so the subtraction yields NaN which we coerce). Stateful
     * non-IIntegrable nodes branch on `Number.isFinite(dt)` for the
     * first-tick case.
     *
     * Single source of truth — replaces per-node `_lastT` mirrors and
     * the `dt` input port pattern. IIntegrable solvers consume the
     * same value when they advance their state.
     */
    public get dt(): number {
        const d = this.currentTick - this.lastT;
        return Number.isFinite(d) ? d : Infinity;
    }

    /** Read-only view of attached solvers (see ISession.solvers). */
    public get solvers(): ReadonlyArray<ISolverHandle> {
        return this._solvers;
    }

    public attachSolver(solver: ISolverHandle): void {
        // Idempotent: re-attaching the same instance is a no-op so the
        // marker node's reset() can be called multiple times safely
        // (e.g. on a config-driven solver rebuild it detaches the old
        // instance and attaches a new one; if the user wired the same
        // marker twice somehow, we don't double-step).
        if (this._solvers.indexOf(solver) >= 0) return;
        this._solvers.push(solver);
    }

    public detachSolver(solver: ISolverHandle): void {
        const idx = this._solvers.indexOf(solver);
        if (idx < 0) return;
        this._solvers.splice(idx, 1);
        try {
            solver.dispose?.();
        } catch {
            // Disposal errors must not break a detach — the worst
            // outcome is a leaked Float64Array, which the GC eventually
            // collects.
        }
    }

    private prepareRun(t: number): void {
        // Advance the session clock BEFORE the scheduler drains, so any
        // deferred LinkRef whose `validAtTick` has come due is moved
        // back to the main queue and treated as a fresh publish for
        // this tick. Re-publish via the public API to preserve overflow
        // accounting (deliveries still go through deliverLinkRef).
        // Push the previous currentTick into lastT BEFORE overwriting,
        // so `dt = currentTick - lastT` reads the correct delta any time
        // during this run (solvers in the integration phase, nodes in
        // the dispatch phase, viz tiles reading session state).
        this.lastT = this.currentTick;
        this.currentTick = t;
        // Bump the integer scheduler tick AFTER the sim-time fields so
        // every `validAtTick` comparison below sees the new value.
        // Started at 0, the first run advances to 1 → events stamped
        // with validAtTick=1 at session construction (via FB.reset)
        // promote on this very first run, matching the design intent
        // of "publish initial values on tick 1".
        this.tickIndex++;

        // ── Phase 1: integration ──────────────────────────────────
        // Drive every attached solver across one macro-step of size
        // `dt`. Each solver advances its owned IIntegrable leaves in
        // place (writeState at the end of step()), so by the time the
        // dispatch phase fires those leaves' `fire()`, they read the
        // already-updated state and publish observation outputs.
        //
        // Skip on the very first run (dt === Infinity): solvers can't
        // step from t=-Infinity, and the leaf state is whatever
        // `gatherState` was seeded with at session construction.
        // Subsequent runs get a finite dt and integrate normally.
        const stepDt = this.dt;
        if (Number.isFinite(stepDt) && stepDt > 0 && this._solvers.length > 0) {
            for (const solver of this._solvers) {
                // Solver failures propagate to the host. Dispatch stops before
                // any leaf can publish observations from stale state.
                solver.step(stepDt, this);
            }
        }

        // ── Phase 2: dispatch (deferred promotion + scheduler) ────
        if (this.deferred.length > 0) {
            // Partition deferred in-place: keep future events, push due
            // events onto the main queue. Walking the array once with a
            // write head avoids two passes / array allocations.
            // Compare against `tickIndex` (integer scheduler counter),
            // NOT `currentTick` (continuous sim-time) — see ILinkRef
            // docs and ISession.tickIndex.
            let writeIdx = 0;
            for (let i = 0; i < this.deferred.length; i++) {
                const ref = this.deferred[i];
                if (ref.validAtTick !== undefined && ref.validAtTick > this.tickIndex) {
                    this.deferred[writeIdx++] = ref;
                } else {
                    // Strip validAtTick so deliverLinkRef doesn't try to
                    // defer it again; it's due now.
                    this.queue.push({ kind: "linkRef", linkIndex: ref.linkIndex, value: ref.value });
                }
            }
            this.deferred.length = writeIdx;
        }

    }

    public async runAsync(t: number): Promise<void> {
        if (this.asyncRunning) throw new Error("This session already has an active async traversal");
        this.asyncRunning = true;
        try {
            this.prepareRun(t);
            if (this.graph.mode === "dynamic") await Scheduler.RunDynamicAsync(this, t);
            else if (this.graph.mode === "static") await Scheduler.RunStaticAsync(this, t);
            else throw new Error(`scheduler not implemented for mode "${this.graph.mode}"`);
        } finally {
            this.asyncRunning = false;
        }
    }

    private asyncRunning = false;

    public run(t: number): void {
        if (this.asyncRunning) throw new Error("This session already has an active async traversal");
        this.prepareRun(t);
        if (this.graph.mode === "dynamic") {
            Scheduler.RunDynamic(this, t);
            return;
        }
        if (this.graph.mode === "static") {
            Scheduler.RunStatic(this, t);
            return;
        }
        throw new Error(`scheduler not implemented for mode "${this.graph.mode}"`);
    }

    /**
     * Buffer-level publish helper for the scheduler. Appends `value`
     * to the destination's slot buffer for the given channel, enforces
     * the per-slot capacity (throws on overflow), and bumps the
     * destination's `linksReady` on the empty → non-empty transition.
     *
     * This is the public entry point the scheduler uses when it pops a
     * LinkRef off the queue. External callers should use `publish()` so
     * the FIFO ordering with other queue items is preserved.
     */
    public deliverLinkRef(ref: ILinkRef): void {
        const link = this._linkAt(ref.linkIndex);
        if (!link || !link.enabled) return;
        const dst = link.ofin as IRuntimeNode | null;
        if (!dst) return;
        // Disabled nodes don't receive tokens — by definition they're
        // not participating in this tick. Dropping the deliver also
        // prevents the buffer-overflow throw when an upstream keeps
        // publishing into a sink the user just toggled off (the classic
        // case is a Viz tile disabled while its data source keeps
        // ticking). On re-enable the node starts receiving fresh tokens
        // from the next upstream publish; nothing in the saved state is
        // stale.
        if (!dst.enabled) return;
        const state = this.nodeStateOf(dst);
        if (!state) return;
        const slot = inSlotOf(link);

        // Signal-kind channels: OVERWRITE the current value, no buffer,
        // no overflow, no linksReady bookkeeping. The destination's
        // `fire()` reads via `readSignal(channelIndex)` whenever it
        // wants; ZOH semantic — between publishes the last value
        // persists.
        if (this._isSignalChannel[ref.linkIndex]) {
            if (!state.inputSignals) state.inputSignals = new Map();
            state.inputSignals.set(slot, ref.value);
            return;
        }

        // Stream-kind channels: legacy FIFO buffer path with overflow
        // detection and linksReady accounting.
        if (!state.inputBuffers || !state.inputCapacity) return;
        let buf = state.inputBuffers.get(slot);
        if (!buf) {
            buf = [];
            state.inputBuffers.set(slot, buf);
        }
        const cap = state.inputCapacity.get(slot) ?? 1;
        if (buf.length >= cap) {
            throw new Error(`[Session] channel overflow on slot "${String(slot)}" ` + `(capacity ${cap}); raise the source port's capacity to allow burst publishes.`);
        }
        const wasEmpty = buf.length === 0;
        buf.push(ref.value);
        if (wasEmpty && !isControlSlot(slot)) {
            state.linksReady++;
        }
    }

    public reset(): void {
        if (this.asyncRunning) throw new Error("This session already has an active async traversal");
        // Drop scheduler queue + deferred queue + every per-slot buffer,
        // and rewind the session clock so any node that re-seeds future
        // events at reset (FeedbackChannel) starts from a fresh epoch.
        this.queue.length = 0;
        this.deferred.length = 0;
        this.currentTick = -Infinity;
        this.lastT = -Infinity;
        this.tickIndex = 0;
        for (const ns of this.nodeStates) {
            if (ns.inputBuffers) {
                for (const buf of ns.inputBuffers.values()) buf.length = 0;
            }
            // Wipe the signal store too — fresh session starts with
            // every signal at "undefined" (reader's responsibility to
            // fall back to a sensible default).
            if (ns.inputSignals) ns.inputSignals.clear();
            ns.linksReady = 0;
        }

        // Pre-seed delayed channels: their initialValue becomes a token
        // on the destination's slot buffer, so the destination can read
        // it on the first cycle and the feedback loop breaks cleanly.
        const links = this.graph.links as ReadonlyArray<IChannel>;
        for (let i = 0; i < links.length; i++) {
            const link = links[i];
            if (!link.delayed || link.initialValue === undefined) continue;
            this.deliverLinkRef({ kind: "linkRef", linkIndex: i, value: link.initialValue });
        }

        // Cascade reset to nodes (sub-graphs reset their internal sessions).
        for (const node of this.graph.nodes) node.reset(this);
        // The nodes hold their initial conditions again; the solvers must
        // read them, or their first macro-step writes the stale vector
        // back over the fresh state.
        for (const solver of this._solvers) solver.reseed?.(0);
    }

    // ── Internals ───────────────────────────────────────────────────────

    private _linkAt(channelIndex: number): IChannel | null {
        const link = this.graph.links[channelIndex] as IChannel | undefined;
        return link ?? null;
    }

    private _bufferFor(link: IChannel): unknown[] | undefined {
        const dst = link.ofin as IRuntimeNode | null;
        if (!dst) return undefined;
        const state = this.nodeStateOf(dst);
        if (!state || !state.inputBuffers) return undefined;
        return state.inputBuffers.get(inSlotOf(link));
    }

    private _onSlotEmptied(link: IChannel): void {
        const dst = link.ofin as IRuntimeNode | null;
        if (!dst) return;
        const state = this.nodeStateOf(dst);
        if (!state) return;
        if (isControlSlot(inSlotOf(link))) return;
        if (state.linksReady > 0) state.linksReady--;
    }

    private _computeRequiredInputs(): number[] {
        const links = this.graph.links as ReadonlyArray<IChannel>;
        return (this.graph.nodes as ReadonlyArray<IRuntimeNode>).map((n) => {
            // Build a slot exclusion set from the node's declared
            // inputPorts: slots marked `kind: "signal"` (preferred,
            // forward-going) or `gating: false` (legacy escape hatch)
            // do NOT count toward `required`. Signals don't sit in a
            // FIFO buffer — they hold a current value persistently —
            // so the scheduler's "buffer non-empty?" gate doesn't apply
            // to them. The node fires every tick and reads the latest
            // signal value via `readSignal`.
            const declared = (n as unknown as { inputPorts?: ReadonlyArray<DeclaredPort> }).inputPorts;
            const slots = new Set<string | number>();
            for (const link of n.opsc<IChannel>()) {
                if (!link.enabled) continue;
                if (links.indexOf(link) < 0) continue;
                const slot = inSlotOf(link);
                if (isControlSlot(slot)) continue;
                const port = declaredPortFor(declared, slot);
                if (port !== undefined && (port.kind === "signal" || port.gating === false)) continue;
                slots.add(slot);
            }
            return slots.size;
        });
    }

    /**
     * Mark nodes that have NO incoming channels at all (true sources:
     * Slider, NumberConstant, Clock, StartNode, ...). These are the
     * only nodes the scheduler seeds at the start of each RunDynamic.
     * Nodes with wired signal-kind inputs intentionally don't seed —
     * they wait for the first signal write to enqueue them, ensuring
     * data dependency order even when their `requiredInputs` is 0.
     */
    private _populateTrueSourceFlags(): void {
        const links = this.graph.links as ReadonlyArray<IChannel>;
        const nodes = this.graph.nodes as ReadonlyArray<IRuntimeNode>;
        this._isTrueSource = nodes.map((n) => {
            for (const link of n.opsc<IChannel>()) {
                if (!link.enabled) continue;
                if (links.indexOf(link) < 0) continue;
                // Any wired non-control input disqualifies. Control-
                // slot wires are part of the lifecycle plane and don't
                // count as data dependencies (StartNode/StopNode can
                // still be true sources even with _start wired).
                if (isControlSlot(inSlotOf(link))) continue;
                return false;
            }
            return true;
        });
    }

    /**
     * Compute the per-channel signal-kind cache. A channel is signal
     * when its DESTINATION port (resolved by slot name on the dest
     * node's declared inputPorts) advertises `kind: "signal"`. Walk
     * once at construction; signal kind is a structural property of
     * the node declaration, not a per-tick value.
     */
    private _populateSignalKinds(): void {
        const links = this.graph.links as ReadonlyArray<IChannel>;
        this._isSignalChannel = new Array(links.length).fill(false);
        for (let i = 0; i < links.length; i++) {
            const link = links[i];
            const dst = link.ofin as IRuntimeNode | null;
            if (!dst) continue;
            const declared = (dst as unknown as { inputPorts?: ReadonlyArray<DeclaredPort> }).inputPorts;
            if (!declared) continue;
            if (declaredPortFor(declared, inSlotOf(link))?.kind === "signal") this._isSignalChannel[i] = true;
        }
    }

    private _buildLinkStatesProxy(): ILinkState[] {
        // Bind the session methods/properties the getters need without
        // aliasing `this` to a local variable (which the @typescript-eslint
        // no-this-alias rule flags). Capturing arrow-functions around the
        // bound methods gives the same closure semantics with a typed
        // surface and no `const session = this` line.
        const linksFor = (): ReadonlyArray<IChannel> => this.graph.links as ReadonlyArray<IChannel>;
        const bufferFor = (link: IChannel): unknown[] | undefined => this._bufferFor(link);
        const isSignalChan = (i: number): boolean => this._isSignalChannel[i] === true;
        const signalValueFor = (link: IChannel): { has: boolean; value: unknown } => {
            const dst = link.ofin as IRuntimeNode | null;
            if (!dst) return { has: false, value: undefined };
            const state = this.nodeStateOf(dst);
            const store = state?.inputSignals;
            if (!store) return { has: false, value: undefined };
            const slot = inSlotOf(link);
            return { has: store.has(slot), value: store.get(slot) };
        };
        return this.graph.links.map(
            (_link, idx) =>
                ({
                    get ready(): boolean {
                        const link = linksFor()[idx] as IChannel | undefined;
                        if (!link) return false;
                        // Signal channels: always report "ready" so the
                        // default RuntimeNode.isReady() (which gates on
                        // every wired non-control input having ready=true)
                        // doesn't block signal-only consumers. They DON'T
                        // sit in a buffer; their value lives in the
                        // node's inputSignals map. A read via readSignal
                        // returns the current value OR undefined if
                        // nothing has been published yet — the consumer's
                        // `fire()` must handle the undefined case with
                        // a sensible default (typically 0).
                        if (isSignalChan(idx)) return true;
                        const buf = bufferFor(link);
                        return !!buf && buf.length > 0;
                    },
                    get payload(): unknown {
                        const link = linksFor()[idx] as IChannel | undefined;
                        if (!link) return undefined;
                        // Signal channels: return the current value from
                        // the signal store. Mirror of the stream path's
                        // buffer-head peek — same backward-compat
                        // surface (linkStates[idx].payload), kind-aware
                        // routing underneath.
                        if (isSignalChan(idx)) {
                            const sig = signalValueFor(link);
                            return sig.has ? sig.value : undefined;
                        }
                        const buf = bufferFor(link);
                        return buf && buf.length > 0 ? buf[0] : undefined;
                    },
                    // Setters are kept off this proxy on purpose. Old code that
                    // mutated `linkStates[i].payload = v` directly was bypassing
                    // the readiness counter; that path is no longer supported.
                }) as ILinkState
        );
    }

    /**
     * Walk every source port declaration on each node and remember the
     * highest capacity advertised for the destination of each channel.
     * Falls back to 1 per slot when nothing is declared. Capacities are
     * resolved once at construction; subsequent topology changes need
     * the session to be rebuilt anyway.
     */
    private _populateCapacities(): void {
        const links = this.graph.links as ReadonlyArray<IChannel>;
        for (let i = 0; i < links.length; i++) {
            const link = links[i];
            if (!link.enabled) continue;
            const dst = link.ofin as IRuntimeNode | null;
            if (!dst) continue;
            const state = this.nodeStateOf(dst);
            if (!state || !state.inputCapacity) continue;
            const slot = inSlotOf(link);

            // Resolve the capacity advertised by the source port (if any).
            let cap = 1;
            const src = link.oini as IRuntimeNode | null;
            const srcSlot = link.slot;
            const declaredOutputs = (src as unknown as { outputPorts?: ReadonlyArray<{ slot: string | number; capacity?: number }> })?.outputPorts;
            const declaredCtrlOut = (src as unknown as { controlOutputPorts?: ReadonlyArray<{ slot: string | number; capacity?: number }> })?.controlOutputPorts;
            const all = [...(declaredOutputs ?? []), ...(declaredCtrlOut ?? [])];
            for (const p of all) {
                if (p.slot === srcSlot && typeof p.capacity === "number" && p.capacity > 0) {
                    cap = Math.max(cap, p.capacity);
                }
            }

            // A destination port may also advertise a capacity; pick the max.
            const declaredInputs = (dst as unknown as { inputPorts?: ReadonlyArray<{ slot: string | number; capacity?: number }> })?.inputPorts;
            const declaredCtrlIn = (dst as unknown as { controlInputPorts?: ReadonlyArray<{ slot: string | number; capacity?: number }> })?.controlInputPorts;
            const allDst = [...(declaredInputs ?? []), ...(declaredCtrlIn ?? [])];
            for (const p of allDst) {
                if (p.slot === slot && typeof p.capacity === "number" && p.capacity > 0) {
                    cap = Math.max(cap, p.capacity);
                }
            }

            const prev = state.inputCapacity.get(slot) ?? 0;
            if (cap > prev) state.inputCapacity.set(slot, cap);
        }
    }
}
