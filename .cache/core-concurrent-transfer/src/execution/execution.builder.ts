// ═══════════════════════════════════════════════════════════════════════════
// RuntimeGraphBuilder : fluent construction of RuntimeGraph<N, L>.
//
// Extends the core GraphBuilder<N, L> and adds the runtime-specific
// concerns (scheduling mode, enabled flag, channel wiring with slot /
// delayed semantics, dangling ports for fractal embedding). All
// concrete object instantiation goes through the protected
// `_createChannel` / `_createGraph` factories; the inherited
// `_createLink` factory is also overridden so the `withLinks(...nodes)`
// chain form works out of the box.
// ═══════════════════════════════════════════════════════════════════════════

import { ICartesian } from "../geometry";
import { GraphBuilder, INode } from "../graph";
import { Nullable } from "../types";
import { Channel } from "./execution.channel";
import { RuntimeGraph } from "./execution.graph";
import { IChannel, IRuntimeNode, SchedulingMode } from "./execution.interfaces";

export class RuntimeGraphBuilder<N extends IRuntimeNode = IRuntimeNode, L extends IChannel = IChannel> extends GraphBuilder<N, L> {
    protected _mode: SchedulingMode = "dynamic";
    protected _enabled: boolean = true;

    public constructor(graph?: RuntimeGraph<N, L>) {
        super(graph);
        if (graph) {
            this._mode = graph.mode;
            this._enabled = graph.enabled;
        }
    }

    /** Seed from a runtime graph and preserve its scheduler configuration. */
    public override withGraph(graph: RuntimeGraph<N, L>): this {
        super.withGraph(graph);
        this._mode = graph.mode;
        this._enabled = graph.enabled;
        return this;
    }

    /**
     * Declare the scheduling mode. Defaults to "dynamic" (ready-queue
     * dispatch). Use "static" for pure-DAG, all-nodes-fire-each-tick
     * graphs where the precomputed topological order suffices.
     */
    public withMode(mode: SchedulingMode): this {
        this._mode = mode;
        return this;
    }

    /**
     * Set the graph-as-node enabled flag (relevant only when this
     * graph is embedded as a node inside a parent graph). Defaults to
     * true.
     */
    public withEnabled(enabled: boolean): this {
        this._enabled = enabled;
        return this;
    }

    /**
     * Register a directed channel between two nodes.
     *
     * `slot` names the OUTPUT port on the source; `toSlot` names the
     * INPUT port on the destination. When the source and destination
     * use the same port name (the common production case) `toSlot`
     * can be omitted and defaults to `slot`. UE5-style editors that
     * connect `node.outPortA` to `otherNode.inPortB` pass both.
     */
    public withChannel(from: N, to: N, slot: string | number = 0, toSlot?: string | number): this {
        const channel = this._createChannel(from, to, slot, false, undefined, toSlot);
        return this.withLinks(channel as unknown as L);
    }

    /**
     * Register a delayed channel pre-seeded with `initialValue`. The
     * initial token is consumed on the first cycle, breaking feedback
     * cycles in DAG-topology graphs.
     */
    public withDelayedChannel<T = unknown>(from: N, to: N, slot: string | number, initialValue: T): this {
        const channel = this._createChannel<T>(from, to, slot, true, initialValue);
        return this.withLinks(channel as unknown as L);
    }

    /**
     * Register a dangling input-port channel (oini = null) at
     * `target` with the given slot name. When this graph is embedded
     * as a node in a parent, the parent's incoming channel whose
     * destination slot carries that name is matched against this port.
     *
     * Pushed onto _links directly: the withLinks() shape sniffing
     * relies on the isOlink guard, which requires BOTH endpoints to be
     * nodes and therefore rejects dangling port channels.
     */
    public withInputPort(target: N, slot: string | number): this {
        const channel = this._createChannel(null, target, slot, false, undefined);
        this._links.push(channel as unknown as L);
        return this;
    }

    /**
     * Register a dangling output-port channel (ofin = null) at
     * `source` with the given slot name. When this graph is embedded
     * as a node, the parent's outgoing channel with that slot name
     * pulls payloads from this port.
     *
     * Pushed onto _links directly for the same isOlink-guard reason as
     * withInputPort.
     */
    public withOutputPort(source: N, slot: string | number): this {
        const channel = this._createChannel(source, null, slot, false, undefined);
        this._links.push(channel as unknown as L);
        return this;
    }

    public override build(): RuntimeGraph<N, L> {
        return super.build() as RuntimeGraph<N, L>;
    }

    // ── Concrete-class factories (override in subclasses) ─────────────

    /**
     * Factory for the concrete channel class. The base implementation
     * builds a plain Channel<T>; subclass builders override to swap in
     * domain-specific channel types.
     */
    protected _createChannel<T = unknown>(
        oini: INode | null,
        ofin: INode | null,
        slot: string | number,
        delayed: boolean,
        initialValue: T | undefined,
        toSlot?: string | number
    ): IChannel<T> {
        return new Channel<T>(oini ?? undefined, ofin ?? undefined, slot, delayed, initialValue, true, toSlot);
    }

    /**
     * Override of GraphBuilder._createLink so the inherited
     * `withLinks(nodeA, nodeB, ...)` chain form produces Channels (slot
     * = 0, not delayed). For custom slots / delayed channels, use the
     * explicit `withChannel` / `withDelayedChannel` methods.
     */
    protected override _createLink(from: N, to: N): L {
        return this._createChannel(from, to, 0, false, undefined) as unknown as L;
    }

    /**
     * Factory for the concrete runtime-graph class. Override returns
     * RuntimeGraph<N, L> (instead of the base Graph<N, L>) and threads
     * the configured mode + enabled flag through the constructor.
     */
    protected override _createGraph(
        nodes: N[],
        links: L[],
        inputs: Nullable<N[]>,
        outputs: Nullable<N[]>,
        hiddens: Nullable<N[]>,
        _onsc: Nullable<L[]>,
        _opsc: Nullable<L[]>,
        position?: ICartesian
    ): RuntimeGraph<N, L> {
        // RuntimeGraph does not accept graph-as-node onsc/opsc through
        // its constructor (they are not part of its embedding contract;
        // dangling port channels carry the slot semantics instead).
        return new RuntimeGraph<N, L>(nodes, links, this._mode, inputs, outputs, hiddens, position, this._enabled);
    }
}
