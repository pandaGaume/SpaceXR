import type { ICartesian } from "../geometry";
import { cloneable } from "../graph/graph.interfaces";
import { RuntimeNode } from "./execution.node";
import { Nullable } from "../types";
import { CONTROL_PORT_ENABLE, CONTROL_PORT_ENABLED, isControlSlot, publishControlOutput } from "./control-ports";
import { inSlotOf } from "./execution.interfaces";
import type {
    IChannel,
    IDeclaresPorts,
    IGraphNodeState,
    ILinkRef,
    INodeState,
    IPortDescriptor,
    IRuntimeGraph,
    IRuntimeNode,
    ISession,
    SchedulingMode,
} from "./execution.interfaces";
import { Session } from "./execution.session";

/**
 * Session specialisation for the sessions a RuntimeGraph owns (the
 * internal session of an embedded sub-graph and the lazy default
 * session behind run()/runAsync()). The per-node-buffer storage model
 * keeps every token in the DESTINATION node's input buffers, so a
 * dangling output-port channel (ofin === null) has nowhere to park its
 * payload and the base deliverLinkRef drops it. This subclass stores
 * the latest value per dangling channel in a session-local map so the
 * embedding boundary (_routeOutputsToParent) can consume it after the
 * internal run. Single-value semantics (overwrite on publish, clear on
 * consume) keep the store bounded when nothing consumes the port, e.g.
 * when ComputeGraph.infer() drives the default session of a graph that
 * also declares output ports.
 */
class PortBufferSession extends Session {
    /**
     * Latest un-consumed value per dangling output channel, keyed by
     * link index. Allocated lazily because the base Session constructor
     * calls reset() (which may deliver pre-seeded delayed channels)
     * before this subclass's field initialisers have run.
     */
    private _portValues?: Map<number, unknown>;

    public override deliverLinkRef(ref: ILinkRef): void {
        const link = this.graph.links[ref.linkIndex] as IChannel | undefined;
        if (link && link.enabled && (link.ofin === null || link.ofin === undefined)) {
            (this._portValues ??= new Map()).set(ref.linkIndex, ref.value);
            return;
        }
        super.deliverLinkRef(ref);
    }

    public override consume(channelIndex: number): unknown {
        if (this._portValues?.has(channelIndex)) {
            const value = this._portValues.get(channelIndex);
            this._portValues.delete(channelIndex);
            return value;
        }
        return super.consume(channelIndex);
    }

    public override peek(channelIndex: number): unknown {
        if (this._portValues?.has(channelIndex)) {
            return this._portValues.get(channelIndex);
        }
        return super.peek(channelIndex);
    }

    public override reset(): void {
        // Clear BEFORE the base reset so values delivered by the base
        // pass (delayed dangling channels pre-seeded with an
        // initialValue) survive into the fresh epoch.
        this._portValues?.clear();
        super.reset();
    }
}

/**
 * IGraphNodeState stamped with the topology version it was built
 * against, so an in-place topology swap (a model node reloading its
 * contents while embedded) lazily rebuilds the stale internal session
 * on the next boundary access instead of having to reach into every
 * parent session eagerly.
 */
interface IVersionedGraphNodeState extends IGraphNodeState {
    topologyVersion?: number;
}

/**
 * Concrete IRuntimeGraph. Extends Graph<N, L> for the topology and
 * implements the IRuntimeNode surface so the graph can be embedded as a
 * node inside a parent graph (fractal composition).
 *
 * Top-level use: the caller creates `new Session(graph)` and drives via
 * session.run(t). The graph's own IRuntimeNode methods are unused; the
 * Session it owns is the entry point.
 *
 * Embedded use: the caller wires this graph as a node in a parent graph
 * via channels. Routing across the embedding boundary uses the channel
 * slot vocabulary directly: an internal channel with `oini === null`
 * (a dangling input port) matches an incoming parent channel by its
 * DESTINATION slot name (toSlot, falling back to slot); an internal
 * channel with `ofin === null` (a dangling output port) matches an
 * outgoing parent channel by its SOURCE slot name. Per-parent-session
 * state (including the internal Session driving this sub-graph) lives
 * in IGraphNodeState within the parent session, so the same
 * IRuntimeGraph instance can be embedded by N concurrent parent
 * sessions without sharing state.
 */
export class RuntimeGraph<N extends IRuntimeNode = IRuntimeNode, L extends IChannel = IChannel> extends RuntimeNode implements IRuntimeGraph<N, L>, IDeclaresPorts {
    // Topology container. Formerly inherited from Graph<N, L>; folded in
    // here (Graph is trivial) so RuntimeGraph IS-A RuntimeNode and inherits
    // the IEnabled control plane + the per-slot routing cache instead of
    // re-declaring them. Graph<N, L> stays the base for the non-runtime
    // graphs (neural-network MlpGraph / CnnGraph).
    public nodes: N[];
    public links: L[];
    public inputs: N[];
    public outputs: N[];
    public hiddens: N[];

    /**
     * Public port descriptors of the embedded graph.
     *
     * When the graph declares boundary port channels (a channel with
     * oini === null is an input port, one with ofin === null is an
     * output port), the descriptors carry those channels' slot NAMES:
     * this is what makes a loaded ONNX model node render its tensor
     * names as wirable ports in the editor, matching the streaming
     * contract (parent channels address them via toSlot / slot).
     *
     * Without boundary channels the getters fall back to source-order
     * positional descriptors: the i-th input port maps to inputs[i]
     * (the i-th source node), the i-th output port to outputs[i], and
     * the embedded routing uses the numeric-index fallback.
     */
    public get inputPorts(): ReadonlyArray<IPortDescriptor> {
        const named = RuntimeGraph._portDescriptorsFrom(this._ensureInputPortMap());
        if (named.length > 0) {
            return named;
        }
        return this.inputs.map((_, i) => ({ slot: i, optional: false }));
    }

    public get outputPorts(): ReadonlyArray<IPortDescriptor> {
        const named = RuntimeGraph._portDescriptorsFrom(this._ensureOutputPortMap());
        if (named.length > 0) {
            return named;
        }
        return this.outputs.map((_, i) => ({ slot: i, optional: false }));
    }

    @cloneable public mode: SchedulingMode;

    /**
     * Lazy default Session for autonomous run() / runAsync() calls.
     * Implementation detail, not exposed via the interface. Callers that
     * need explicit Session control pass their own via the optional
     * `session` argument of run/runAsync.
     */
    private _defaultSession?: Session;

    public constructor(
        nodes: N[] = [],
        links: L[] = [],
        mode: SchedulingMode = "dynamic",
        inputs: Nullable<N[]> = null,
        outputs: Nullable<N[]> = null,
        hiddens: Nullable<N[]> = null,
        position?: ICartesian,
        enabled: boolean = true
    ) {
        super(null, null, position, enabled); // RuntimeNode: empty onsc/opsc, sets enabled
        this.mode = mode;
        this.nodes = nodes;
        this.links = links;
        this.inputs = inputs ?? this.nodes.filter((n) => n.opsc().length === 0);
        this.outputs = outputs ?? this.nodes.filter((n) => n.onsc().length === 0);
        this.hiddens = hiddens ?? this.nodes.filter((n) => !this.inputs.includes(n) && !this.outputs.includes(n));
    }

    /** Deep topology clone (preserved from Graph): copy nodes + re-bind the
     *  cloned links onto the cloned nodes, then re-derive the in/out/hidden
     *  partition. The @cloneable scalars (mode, enabled, ...) come from
     *  super.clone(). */
    public override clone(): this {
        const copy = super.clone() as this;
        copy.nodes = this.nodes.map((n) => n.clone() as N);
        copy.links = this.links.map((l) => {
            const cloned = l.clone() as L;
            const oi = this.nodes.indexOf(l.oini as N);
            const fi = this.nodes.indexOf(l.ofin as N);
            cloned.oini = oi >= 0 ? copy.nodes[oi] : null;
            cloned.ofin = fi >= 0 ? copy.nodes[fi] : null;
            return cloned;
        });
        copy.inputs = copy.nodes.filter((n) => n.opsc().length === 0);
        copy.outputs = copy.nodes.filter((n) => n.onsc().length === 0);
        copy.hiddens = copy.nodes.filter((n) => !copy.inputs.includes(n) && !copy.outputs.includes(n));
        return copy;
    }

    /**
     * Monotonic counter bumped by invalidateTopology(). Internal
     * sessions record the version they were built against; a mismatch
     * on the next boundary access triggers a lazy rebuild.
     */
    private _topologyVersion: number = 0;

    /**
     * Per-parent-session state factory: allocates an internal Session
     * keyed to this sub-graph. Each parent session calling this gets a
     * distinct internalSession, so concurrent embeddings do not share
     * runtime state. The state is stamped with the current topology
     * version so an in-place reload (see invalidateTopology) can
     * detect and replace stale sessions lazily.
     */
    public createNodeState(): IGraphNodeState {
        const state: IVersionedGraphNodeState = {
            linksReady: 0,
            internalSession: new PortBufferSession(this),
            topologyVersion: this._topologyVersion,
        };
        return state;
    }

    /**
     * Adopt another graph's topology in place: copy its nodes / links /
     * input-output partition, then invalidate the topology-derived
     * caches so the next boundary access rebuilds against the new
     * interior. This is the swap an embedded container performs when it
     * is materialized from a serialized interior (the sub-graph JSON of
     * a Sim.Graph, the model bytes of an ONNX node): build a throwaway
     * RuntimeGraph through the builder, then graft its topology onto the
     * live embedded instance so the IGraphNodeState held by every parent
     * session lazily re-binds to the populated graph.
     */
    public adoptTopologyFrom(other: RuntimeGraph<N, L>): void {
        this.nodes = other.nodes;
        this.links = other.links;
        this.inputs = other.inputs;
        this.outputs = other.outputs;
        this.hiddens = other.hiddens;
        this.invalidateTopology();
    }

    /**
     * Notify the runtime that nodes/links were swapped in place (e.g.
     * a model node reloading its contents while embedded). Drops every
     * topology-derived cache: the memoized boundary-port maps, the
     * lazy default session behind run()/infer(), and (via the version
     * stamp) the internal sessions held inside parent sessions, which
     * are rebuilt on their next boundary access.
     */
    public invalidateTopology(): void {
        this._topologyVersion++;
        this._inputPortMap = undefined;
        this._outputPortMap = undefined;
        this._defaultSession = undefined;
    }

    public isReady(parentSession: ISession): boolean {
        if (!this.enabled) {
            return false;
        }
        const incoming = this.opsc<IChannel>();
        for (const link of incoming) {
            if (!link.enabled) {
                continue;
            }
            // Control-plane inputs (_enable, ...) are drained by
            // processControlInputs BEFORE this gate, exactly like on
            // RuntimeNode; their per-channel readiness must not block
            // the data firing decision.
            if (isControlSlot(inSlotOf(link))) {
                continue;
            }
            const state = parentSession.linkStateOf(link);
            if (!state) {
                // Channel belongs to a different parent session (this
                // sub-graph instance is embedded in N parents); skip.
                continue;
            }
            if (!state.ready) {
                return false;
            }
        }
        return true;
    }

    public fire(parentSession: ISession, t: number): void {
        const inner = this._routeInputsFromParent(parentSession);
        if (!inner) {
            return;
        }
        inner.run(t);
        this._routeOutputsToParent(parentSession, inner);
    }

    /**
     * Async embedding variant of fire(): same I/O routing but drives
     * the sub-graph's internal topology via this graph's own
     * runAsync() on the internal session, so async nodes inside the
     * sub-graph are awaited rather than skipped.
     */
    public async fireAsync(parentSession: ISession, t: number): Promise<void> {
        const inner = this._routeInputsFromParent(parentSession);
        if (!inner) {
            return;
        }
        await this.runAsync(t, inner);
        this._routeOutputsToParent(parentSession, inner);
    }

    /**
     * Route incoming external channels into the internal session.
     * Returns the internal session (or undefined if this graph is not
     * embedded in the given parent session's graph, or if the firing
     * policy below dropped the tokens, in which case the caller skips
     * the internal run).
     *
     * Boundary matching: each external incoming link's DESTINATION
     * slot (toSlot, falling back to slot per inSlotOf) is matched
     * against an internal input port (a channel whose oini is null).
     * The editor convention names the source's output port in `slot`
     * and this graph's input port in `toSlot`, so the destination
     * side is the authoritative name; `slot` is retried only for
     * genuine legacy single-name channels (toSlot omitted or equal to
     * slot). A defined DISTINCT toSlot that matches nothing goes to
     * the drop path, never to a coincidentally same-named port.
     * Lazily memoized in the port maps for O(1) subsequent lookups.
     *
     * Firing policy: an embedded graph fires ALL-OR-NOTHING on its
     * declared input ports. Before anything is published into the
     * inner session, every dangling input-port channel of the inner
     * graph must be covered by a READY parent channel in this fire;
     * otherwise the ready tokens are consumed and DROPPED (same policy
     * as the unmatched-slot drop) and the internal run is skipped. A
     * partially fed fire would otherwise leave a joining op's fed slot
     * full (capacity 1) inside the inner session and the next fire
     * would throw a channel overflow out of the PARENT session.
     */
    protected _routeInputsFromParent(parentSession: ISession): ISession | undefined {
        const inner = this._internalSessionIn(parentSession);
        if (!inner) {
            return undefined;
        }
        const parentLinks = parentSession.graph.links as ReadonlyArray<IChannel>;

        // Pass 1: resolve every READY incoming data channel to its
        // internal port WITHOUT consuming anything yet, so the
        // all-or-nothing gate can decide before any token moves.
        let ready: Array<{ parentIdx: number; internalIdx: number; inSlot: string | number }> | undefined;
        for (const link of this.opsc<IChannel>()) {
            if (!link.enabled) {
                continue;
            }
            const inSlot = inSlotOf(link);
            // Control-plane tokens are drained by processControlInputs
            // before fire(); never route (or drop) them here.
            if (isControlSlot(inSlot)) {
                continue;
            }
            const parentIdx = parentLinks.indexOf(link);
            const parentState = parentSession.linkStateOf(link);
            if (parentIdx < 0 || !parentState || !parentState.ready) {
                continue;
            }
            let internalIdx = this._inputPortIndex(inSlot);
            if (internalIdx < 0 && (link.toSlot === undefined || link.toSlot === link.slot)) {
                // Genuine legacy single-name channels only: retrying
                // link.slot for a DISTINCT toSlot that matches nothing
                // would misroute the token into a coincidentally
                // same-named internal port (e.g. after a model swap);
                // such tokens go to the drop path instead.
                internalIdx = this._inputPortIndex(link.slot);
            }
            (ready ??= []).push({ parentIdx, internalIdx, inSlot });
        }

        // All-or-nothing gate over the declared input ports.
        const portMap = this._ensureInputPortMap();
        if (portMap.size > 0) {
            const covered = new Set<number>();
            if (ready) {
                for (const r of ready) {
                    if (r.internalIdx >= 0) {
                        covered.add(r.internalIdx);
                    }
                }
            }
            if (covered.size < portMap.size) {
                // Drop the half-fire: consume every ready token (they
                // are addressed to this node; leaving them buffered
                // would keep it dispatch-eligible forever in the
                // dynamic scheduler) and skip the internal run.
                if (ready) {
                    for (const r of ready) {
                        parentSession.consume(r.parentIdx);
                    }
                }
                return undefined;
            }
        }

        // Pass 2: consume and route.
        if (ready) {
            for (const r of ready) {
                // Always consume the token: it is addressed to this
                // node. A slot that matches no internal port is dropped
                // (e.g. an unloaded model node).
                const value = parentSession.consume(r.parentIdx);
                if (r.internalIdx >= 0) {
                    inner.publish(r.internalIdx, value);
                    continue;
                }
                // Source-order fallback: slot is a numeric index into inputs[].
                // Writes the value onto the source node's bag.pendingInput,
                // which Kernel-style _gatherInputs picks up for nodes with
                // no incoming channels (the canonical source-node case).
                if (typeof r.inSlot === "number" && r.inSlot >= 0 && r.inSlot < this.inputs.length) {
                    const src = this.inputs[r.inSlot];
                    const bag = (src.bag ?? {}) as Record<string, unknown>;
                    bag.pendingInput = value;
                    src.bag = bag as N["bag"];
                }
            }
        }
        return inner;
    }

    /**
     * Route internal output link states back to external channels in
     * the parent session.
     *
     * Boundary matching: each external outgoing link's slot is matched
     * against an internal output port (a channel whose ofin is null).
     *
     * Fan-out safety: ONE internal output port may feed SEVERAL parent
     * channels, and consume() is destructive (the PortBufferSession
     * dangling-port store deletes its value on first read; a buffered
     * super-Session shifts its FIFO head). So the matched parent links
     * are grouped by internal port first, the port value is peek()ed
     * exactly once (non-destructive), published to EVERY matched parent
     * link, and the port is cleared with a single consume() at the end.
     */
    protected _routeOutputsToParent(parentSession: ISession, inner: ISession): void {
        const parentLinks = parentSession.graph.links as ReadonlyArray<IChannel>;
        // internalIdx of an output port -> parent link indices fed by it.
        let fanout: Map<number, number[]> | undefined;
        for (const link of this.onsc<IChannel>()) {
            if (!link.enabled) {
                continue;
            }
            const parentIdx = parentLinks.indexOf(link);
            if (parentIdx < 0) {
                continue;
            }
            const internalIdx = this._outputPortIndex(link.slot);
            if (internalIdx >= 0) {
                fanout ??= new Map();
                const targets = fanout.get(internalIdx);
                if (targets) {
                    targets.push(parentIdx);
                } else {
                    fanout.set(internalIdx, [parentIdx]);
                }
                continue;
            }
            // Source-order fallback: slot is a numeric index into outputs[].
            // Reads the value from the sink node's bag.lastOutputs[0], which
            // Kernel-style _publishOutputs stashes there after execute().
            // Reading the bag is non-destructive, so fan-out is safe here.
            if (typeof link.slot === "number" && link.slot >= 0 && link.slot < this.outputs.length) {
                const sink = this.outputs[link.slot];
                const bag = sink.bag as { lastOutputs?: ReadonlyArray<unknown> } | undefined;
                const value = bag?.lastOutputs?.[0];
                if (value !== undefined) {
                    parentSession.publish(parentIdx, value);
                }
            }
        }
        if (!fanout) {
            return;
        }
        for (const [internalIdx, targets] of fanout) {
            // peek() reads the dangling-port store of the internal
            // PortBufferSession (a channel with ofin === null has no
            // destination buffer) or the buffer head of a plain
            // Session; undefined means nothing was produced on this
            // port during the run.
            const value = inner.peek(internalIdx);
            if (value !== undefined) {
                for (const parentIdx of targets) {
                    parentSession.publish(parentIdx, value);
                }
            }
            // Clear the port once per fire, regardless of fan-out width.
            inner.consume(internalIdx);
        }
    }

    // ── Port-channel lookup (memoized) ────────────────────────────────
    //
    // Input ports : internal channels whose oini === null.
    // Output ports: internal channels whose ofin === null.
    // The slot of a port channel is its public name; embedding code
    // matches external link.slot against these.

    private _inputPortMap?: Map<string | number, number>;
    private _outputPortMap?: Map<string | number, number>;

    private _ensureInputPortMap(): Map<string | number, number> {
        if (!this._inputPortMap) {
            this._inputPortMap = new Map();
            for (let i = 0; i < this.links.length; i++) {
                const link = this.links[i] as unknown as IChannel;
                if (link.oini === null || link.oini === undefined) {
                    this._inputPortMap.set(link.slot, i);
                }
            }
        }
        return this._inputPortMap;
    }

    private _ensureOutputPortMap(): Map<string | number, number> {
        if (!this._outputPortMap) {
            this._outputPortMap = new Map();
            for (let i = 0; i < this.links.length; i++) {
                const link = this.links[i] as unknown as IChannel;
                if (link.ofin === null || link.ofin === undefined) {
                    this._outputPortMap.set(link.slot, i);
                }
            }
        }
        return this._outputPortMap;
    }

    private _inputPortIndex(slot: string | number): number {
        const idx = this._ensureInputPortMap().get(slot);
        return idx === undefined ? -1 : idx;
    }

    private _outputPortIndex(slot: string | number): number {
        const idx = this._ensureOutputPortMap().get(slot);
        return idx === undefined ? -1 : idx;
    }

    /** Build editor-facing descriptors from a memoized port map. */
    private static _portDescriptorsFrom(map: Map<string | number, number>): IPortDescriptor[] {
        const ports: IPortDescriptor[] = [];
        for (const slot of map.keys()) {
            ports.push({ slot, optional: false });
        }
        return ports;
    }

    /**
     * Same _enable / _enabled control-input handling as RuntimeNode, so
     * an embedded graph behaves like any other IRuntimeNode under the
     * scheduler's control-plane drain. Internal nodes get their own
     * control inputs processed by the inner scheduler when fire() runs.
     */
    public processControlInputs(parentSession: ISession): void {
        const links = parentSession.graph.links as ReadonlyArray<IChannel>;
        const prevEnabled = this.enabled;
        let received = false;
        let nextEnabled = prevEnabled;
        for (const link of this.opsc<IChannel>()) {
            if (inSlotOf(link) !== CONTROL_PORT_ENABLE || !link.enabled) continue;
            const idx = links.indexOf(link);
            if (idx < 0) continue;
            if (!parentSession.linkStates[idx].ready) continue;
            const value = parentSession.consume(idx);
            received = true;
            nextEnabled = !!value;
        }
        if (received && nextEnabled !== prevEnabled) {
            this.enabled = nextEnabled;
            this.notifyPropertyChanged("enabled", prevEnabled, nextEnabled);
            publishControlOutput(this, parentSession, CONTROL_PORT_ENABLED, nextEnabled);
        }
    }

    public reset(parentSession: ISession): void {
        // The Session.reset() that triggered this call already zeroed
        // linksReady on every nodeState; we only need to reset our
        // internal session, which cascades to our internal nodes.
        const inner = this._internalSessionIn(parentSession);
        inner?.reset();
    }

    // ── ITickable: autonomous drive on the default (or caller-provided) session ──

    public run(t: number, session?: ISession): void {
        const target = session ?? this._ensureDefaultSession();
        target.run(t);
    }

    public async runAsync(t: number, session?: ISession): Promise<void> {
        const target = session ?? this._ensureDefaultSession();
        await target.runAsync(t);
    }

    /**
     * Reset the default Session if one has been lazily allocated.
     * Class-only convenience; not part of any interface. Callers using
     * their own Session via run(t, session) manage its lifecycle
     * themselves.
     */
    public resetSession(): void {
        this._defaultSession?.reset();
    }

    private _ensureDefaultSession(): Session {
        return (this._defaultSession ??= new PortBufferSession(this));
    }

    /**
     * Retrieves this sub-graph's internal session from its IGraphNodeState
     * inside the given parent session. Returns undefined when the parent
     * session was not constructed against a graph containing this
     * sub-graph (defensive).
     *
     * A session stamped with an older topology version (the graph was
     * reloaded in place since the parent session was constructed, see
     * invalidateTopology) is rebuilt here lazily. States without a
     * version stamp come from custom createNodeState overrides and are
     * left untouched.
     */
    protected _internalSessionIn(parentSession: ISession): ISession | undefined {
        const state = parentSession.nodeStateOf(this) as IVersionedGraphNodeState | INodeState | undefined;
        if (state && "internalSession" in state) {
            if (state.topologyVersion !== undefined && state.topologyVersion !== this._topologyVersion) {
                state.internalSession = new PortBufferSession(this);
                state.topologyVersion = this._topologyVersion;
            }
            return state.internalSession;
        }
        return undefined;
    }
}
