import type { ICartesian } from "../geometry";
import { cloneable, IOlink } from "../graph/graph.interfaces";
import { GraphNode } from "../graph/graph.node";
import { Nullable } from "../types";
import { CONTROL_PORT_ENABLE, CONTROL_PORT_ENABLED, ENABLE_INPUT_PORT, ENABLED_OUTPUT_PORT, isControlSlot, publishControlOutput } from "./control-ports";
import { IChannel, IDeclaresControlPorts, IPortDescriptor, IRuntimeNode, ISession, inSlotOf } from "./execution.interfaces";

/** Shared frozen empty result so a slot miss in the routing cache costs
 *  no allocation. */
const EMPTY_CHANNELS: ReadonlyArray<IChannel> = Object.freeze([]);

/**
 * Concrete IRuntimeNode base. Provides default isReady (all non-disabled
 * incoming channels are ready in the session) and no-op fire/reset that
 * subclasses override. State lives in the session, not on the node, so
 * one instance is safe across N parallel sessions.
 */
export class RuntimeNode<B = unknown> extends GraphNode<B> implements IRuntimeNode<B>, IDeclaresControlPorts {
    @cloneable public enabled: boolean;

    /**
     * Default to true: every plain RuntimeNode supports the enable
     * toggle. Always-on subclasses (StartNode, StopNode) override to
     * false to hide the toggle in editors without disturbing the
     * structural IEnabled contract.
     */
    public readonly supportsEnabling: boolean = true;

    /**
     * Default control plane: every RuntimeNode is IEnabled, so it
     * exposes _enable (boolean input) to set the state and _enabled
     * (boolean output) to broadcast it. Subclasses override to extend
     * with start/stop (see RunnableNode) or other lifecycle ports.
     * Override-by-assignment is fine since the property is declared
     * readonly here but reassigned in subclass field initialisers.
     */
    public readonly controlInputPorts: ReadonlyArray<IPortDescriptor> = [ENABLE_INPUT_PORT];
    public readonly controlOutputPorts: ReadonlyArray<IPortDescriptor> = [ENABLED_OUTPUT_PORT];

    /**
     * Routing caches maintained by the attach/detach hooks below, so
     * fire()/isReady() look channels up by slot in O(1) instead of
     * rescanning opsc()/onsc() + string-matching + linear `indexOf` every
     * tick:
     *   _inBySlot  incoming channels keyed by DESTINATION slot (inSlotOf)
     *   _outBySlot outgoing channels keyed by SOURCE slot (channel.slot)
     *
     * Declared WITHOUT an initializer on purpose: GraphNode's constructor
     * fires the *Added hooks for pre-populated arrays DURING super(), i.e.
     * before subclass field initializers run, so a `= new Map()` here could
     * (under useDefineForClassFields) wipe entries created in super(). The
     * maps are created lazily via `??=` in the hooks instead.
     */
    private _inBySlot?: Map<string | number, IChannel[]>;
    private _outBySlot?: Map<string | number, IChannel[]>;

    public constructor(onsc: Nullable<IOlink[]> = null, opsc: Nullable<IOlink[]> = null, position?: ICartesian, enabled: boolean = true) {
        super(onsc, opsc, position);
        this.enabled = enabled;
    }

    public isReady(session: ISession): boolean {
        if (!this.enabled) {
            return false;
        }
        const incoming = this.opsc<IChannel>();
        for (const link of incoming) {
            if (!link.enabled) {
                continue;
            }
            // Control-plane inputs (_enable, _start, _stop, _reset, ...)
            // are drained by `processControlInputs` BEFORE this gate, so
            // their per-channel readiness is irrelevant to the data
            // firing decision. Treating an unwired or empty control
            // input as "not ready" would otherwise prevent any node
            // with required=0 + wired control input from ever firing.
            if (isControlSlot(inSlotOf(link))) {
                continue;
            }
            const idx = this.channelIndex(session, link);
            if (idx < 0) {
                continue;
            }
            if (!session.linkStates[idx].ready) {
                return false;
            }
        }
        return true;
    }

    public fire(_session: ISession, _t: number): void {
        // Concrete nodes override.
    }

    /**
     * Default async fire: delegates to the sync fire(). Nodes that wrap
     * genuinely async work (GPU, WebWorker, ONNX runtime) override to
     * await their async primitive. RuntimeGraph.runAsync invokes this
     * uniformly without checking which path applies.
     */
    public async fireAsync(session: ISession, t: number): Promise<void> {
        this.fire(session, t);
    }

    public reset(_session: ISession): void {
        // Concrete nodes override.
    }

    /**
     * Default control-input processing. Drains the _enable channel(s)
     * if any; applies the latest received boolean value to this.enabled
     * and broadcasts the new state on the _enabled output (only when it
     * actually changed). Subclasses override to extend (RunnableNode
     * adds _start / _stop trigger handling).
     */
    public processControlInputs(session: ISession): void {
        const prevEnabled = this.enabled;
        let received = false;
        let nextEnabled = prevEnabled;

        for (const link of this.inputChannels(CONTROL_PORT_ENABLE)) {
            if (!link.enabled) continue;
            const idx = this.channelIndex(session, link);
            if (idx < 0) continue;
            if (!session.linkStates[idx].ready) continue;
            const value = session.consume(idx);
            received = true;
            nextEnabled = !!value;
        }

        if (received && nextEnabled !== prevEnabled) {
            this.enabled = nextEnabled;
            this.notifyPropertyChanged("enabled", prevEnabled, nextEnabled);
            publishControlOutput(this, session, CONTROL_PORT_ENABLED, nextEnabled);
        }
    }

    // ── Per-slot routing cache (driven by the GraphNode attach/detach
    //    hooks) + O(1) channel-index resolution. ─────────────────────────

    protected override pscAdded<L extends IOlink>(...links: Array<L>): void {
        for (const link of links) {
            const ch = link as unknown as IChannel;
            const key = inSlotOf(ch);
            if ((key as unknown) === undefined) continue; // structural relation (no slot), not a channel
            const map = (this._inBySlot ??= new Map());
            const arr = map.get(key);
            if (arr) arr.push(ch);
            else map.set(key, [ch]);
        }
    }

    protected override pscRemoved<L extends IOlink>(...links: Array<L>): void {
        const map = this._inBySlot;
        if (!map) return;
        for (const link of links) {
            const ch = link as unknown as IChannel;
            const key = inSlotOf(ch);
            if ((key as unknown) === undefined) continue; // structural relation (no slot)
            const arr = map.get(key);
            if (!arr) continue;
            const i = arr.indexOf(ch);
            if (i >= 0) arr.splice(i, 1);
            if (arr.length === 0) map.delete(key);
        }
    }

    protected override nscAdded<L extends IOlink>(...links: Array<L>): void {
        for (const link of links) {
            const ch = link as unknown as IChannel;
            if ((ch.slot as unknown) === undefined) continue; // structural relation (no slot)
            const map = (this._outBySlot ??= new Map());
            const arr = map.get(ch.slot);
            if (arr) arr.push(ch);
            else map.set(ch.slot, [ch]);
        }
    }

    protected override nscRemoved<L extends IOlink>(...links: Array<L>): void {
        const map = this._outBySlot;
        if (!map) return;
        for (const link of links) {
            const ch = link as unknown as IChannel;
            if ((ch.slot as unknown) === undefined) continue; // structural relation (no slot)
            const arr = map.get(ch.slot);
            if (!arr) continue;
            const i = arr.indexOf(ch);
            if (i >= 0) arr.splice(i, 1);
            if (arr.length === 0) map.delete(ch.slot);
        }
    }

    /** Incoming channels bound to `slot` (destination side), in attach
     *  order. O(1); an empty frozen array when nothing is wired there. */
    protected inputChannels(slot: string | number): ReadonlyArray<IChannel> {
        return this._inBySlot?.get(slot) ?? EMPTY_CHANNELS;
    }

    /** Outgoing channels leaving `slot` (source side), in attach order. */
    protected outputChannels(slot: string | number): ReadonlyArray<IChannel> {
        return this._outBySlot?.get(slot) ?? EMPTY_CHANNELS;
    }

    /**
     * Consume the latest ready value on input `slot` (last-wins when several
     * channels feed the same slot, matching the legacy opsc-iteration order)
     * and return it, or `undefined` when nothing is ready. ALWAYS consumes
     * every ready token on the slot so an upstream producer is never
     * stalled. The common "input wins over default" case; nodes that need
     * every value (sum / peek / per-channel handling) iterate
     * `inputChannels(slot)` themselves.
     */
    protected consumeLatest(session: ISession, slot: string | number): unknown {
        let value: unknown = undefined;
        for (const ch of this.inputChannels(slot)) {
            if (!ch.enabled) continue;
            const idx = this.channelIndex(session, ch);
            if (idx < 0 || !session.linkStates[idx].ready) continue;
            value = session.consume(idx);
        }
        return value;
    }

    /** Publish `value` on every enabled output channel leaving `slot`. */
    protected publishAll(session: ISession, slot: string | number, value: unknown): void {
        for (const ch of this.outputChannels(slot)) {
            if (!ch.enabled) continue;
            const idx = this.channelIndex(session, ch);
            if (idx < 0) continue;
            session.publish(idx, value);
        }
    }

    /**
     * Position of `ch` in the session's flat link array (the key into
     * session.linkStates / consume / publish / peek). Resolved ONCE and
     * cached ON THE CHANNEL: the index is GRAPH-scoped, not session-scoped.
     * A channel belongs to a single graph, its position there is fixed at
     * build, and every session of that graph (including the fractal inner
     * sessions, which all wrap the same RuntimeGraph) sees the same array,
     * so the cached index is valid across them all. A topology rebuild
     * (adoptTopologyFrom) installs FRESH channels, so a channel never sees a
     * second link array; no array-identity guard is needed. A transient -1
     * (channel not yet in the graph) is not cached. Returns -1 if absent.
     */
    protected channelIndex(session: ISession, ch: IChannel): number {
        const c = ch as IChannel & { _idx?: number };
        if (c._idx !== undefined) {
            return c._idx;
        }
        const idx = (session.graph.links as ReadonlyArray<IOlink>).indexOf(ch);
        if (idx >= 0) {
            c._idx = idx;
        }
        return idx;
    }
}
