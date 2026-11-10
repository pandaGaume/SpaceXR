import { IChannel, IRuntimeGraph, IRuntimeNode, ISession, ILinkRef, IStaticEligibility, IStaticRunOptions, isLinkRef, inSlotOf } from "./execution.interfaces";
import { isControlSlot } from "./control-ports";
import type { Session } from "./execution.session";

/**
 * Kahn topological order over the subgraph induced by enabled and
 * non-delayed channels. Returns the order plus a (possibly empty) list
 * of reasons explaining any cycle. order is empty when a cycle exists.
 */
function topoSort(graph: IRuntimeGraph): { order: IRuntimeNode[]; reasons: string[] } {
    const nodes = graph.nodes;
    const inDeg = new Map<IRuntimeNode, number>();
    const adj = new Map<IRuntimeNode, IRuntimeNode[]>();

    for (const n of nodes) {
        inDeg.set(n, 0);
        adj.set(n, []);
    }

    const links = graph.links as ReadonlyArray<IChannel>;
    for (const link of links) {
        if (!link.enabled || link.delayed) {
            continue;
        }
        const src = link.oini as IRuntimeNode | null;
        const dst = link.ofin as IRuntimeNode | null;
        if (!src || !dst || !inDeg.has(src) || !inDeg.has(dst)) {
            continue;
        }
        adj.get(src)!.push(dst);
        inDeg.set(dst, inDeg.get(dst)! + 1);
    }

    const queue: IRuntimeNode[] = [];
    const order: IRuntimeNode[] = [];
    for (const n of nodes) {
        if (inDeg.get(n) === 0) {
            queue.push(n);
        }
    }
    while (queue.length > 0) {
        const n = queue.shift()!;
        order.push(n);
        for (const dst of adj.get(n)!) {
            const d = inDeg.get(dst)! - 1;
            inDeg.set(dst, d);
            if (d === 0) {
                queue.push(dst);
            }
        }
    }

    if (order.length !== nodes.length) {
        const remaining = nodes.filter((n) => !order.includes(n));
        const ids = remaining.map((n) => (n.id !== undefined ? String(n.id) : "?")).join(",");
        return {
            order: [],
            reasons: [`cycle through non-delayed channels among nodes [${ids}]; mark one channel as delayed to break it`],
        };
    }
    return { order, reasons: [] };
}

/**
 * Scheduler strategies.
 *
 *   RunDynamic   FIFO drain over the session's queue, which holds
 *                LinkRefs (publish events) and IRuntimeNode entries
 *                (ready-check requests). The drain alternates between
 *                them naturally: a LinkRef delivers its value into the
 *                destination's per-slot buffer and re-queues the
 *                destination; a node entry consumes one token per
 *                gating slot when ready and may re-queue itself if
 *                multiple tokens were buffered (the loop case).
 *
 *   RunStatic    Kahn topological order over the non-delayed enabled-
 *                channel subgraph. Visits each enabled node once in
 *                that order with the same isReady() / processControl
 *                contract. Cheap when applicable but does NOT support
 *                multi-token (loop) bursts; raise a static-ineligible
 *                error if any link has a capacity > 1.
 *
 *   CheckStaticEligible  Validates RunStatic preconditions.
 */
export class Scheduler {
    /** Sync and async execution share the same native queue and readiness rules. */
    public static RunDynamic(session: ISession, t: number): void {
        for (const item of Scheduler.dynamicDispatch(session)) {
            if (isLinkRef(item)) (session as Session).deliverLinkRef(item);
            else item.fire(session, t);
        }
    }

    public static async RunDynamicAsync(session: ISession, t: number): Promise<void> {
        if (Scheduler.activeAsyncSessions.has(session)) {
            throw new Error("This session already has an active async traversal");
        }
        Scheduler.activeAsyncSessions.add(session);
        try {
            for (const item of Scheduler.dynamicDispatch(session)) {
                if (isLinkRef(item)) {
                    if (session.deliverLinkRefsAsync) await session.deliverLinkRefsAsync([item], t);
                    else (session as Session).deliverLinkRef(item);
                } else await item.fireAsync(session, t);
            }
        } finally {
            Scheduler.activeAsyncSessions.delete(session);
        }
    }

    private static *dynamicDispatch(session: ISession): Generator<IRuntimeNode | ILinkRef, void> {
        const sess = session as Session;
        const queue = sess.queue;
        const nodes = session.graph.nodes as ReadonlyArray<IRuntimeNode>;
        // Per-tick fire deduplication for signal-only nodes: a node
        // that's been re-queued by a signal-channel publish and has no
        // stream inputs to drain MUST NOT fire more than once per
        // tick. Without this, a signal-only cycle (e.g. PI → PWM →
        // Motor → PI through signal channels) loops forever because
        // each re-queue from a signal write triggers another fire,
        // which publishes another signal, which re-queues again, etc.
        //
        // Stream-input nodes are excluded from the dedup — they may
        // legitimately fire N times per tick if their buffer holds N
        // tokens (the existing loop-burst semantic from RunDynamic's
        // post-fire `linksReady > 0` re-queue path).
        const firedSignalOnly = new Set<IRuntimeNode>();

        // Seed: enqueue only TRUE SOURCES (no wired inputs at all)
        // and nodes whose buffers were pre-seeded by Session.reset
        // (delayed channels with initialValue). Nodes whose required=0
        // is due to signal-kind inputs (Speed PI, FB Channel after the
        // U.* migration) do NOT seed — they wait for the first signal
        // write to enqueue them. This preserves topological dataflow
        // order even for signal-only-input nodes; without it, such
        // nodes would fire at the start of the tick with stale signal
        // values, then never re-fire to see the freshly published
        // current-tick data.
        for (let i = 0; i < nodes.length; i++) {
            const node = nodes[i];
            if (!node.enabled) continue;
            const state = session.nodeStates[i];
            const required = session.requiredInputsOf(node);
            const sess = session as unknown as { isTrueSource(n: IRuntimeNode): boolean };
            const isSource = typeof sess.isTrueSource === "function" ? sess.isTrueSource(node) : required === 0;
            if (isSource) {
                queue.push(node);
                continue;
            }
            // Buffer-ready (pre-seeded delayed channel) → also seed.
            if (state.linksReady >= required && required > 0) {
                queue.push(node);
            }
        }

        while (queue.length > 0) {
            const item = queue.shift()!;

            if (isLinkRef(item)) {
                // Deliver the value into the destination's per-slot
                // buffer and re-queue the destination for a ready-check.
                yield item;
                const link = session.graph.links[item.linkIndex] as IChannel | undefined;
                if (!link || !link.enabled) continue;
                const dst = link.ofin as IRuntimeNode | null;
                if (!dst || !dst.enabled) continue;
                if (nodes.indexOf(dst) < 0) continue;
                queue.push(dst);
                continue;
            }

            // Node ready-check entry. Drain its control-plane inputs
            // first (e.g. _enable, _start, _stop / _reset) so the
            // enabled/isReady gates see the latest state.
            const node = item;
            node.processControlInputs?.(session);
            if (!node.enabled) continue;

            const required = session.requiredInputsOf(node);
            const state = session.nodeStateOf(node);
            if (!state) continue;
            if (state.linksReady < required) continue;
            if (!node.isReady(session)) continue;
            // Signal-only dedup: a node with required=0 (which
            // includes all signal-only consumers) fires at most once
            // per tick. Stream-input nodes (required>0) sidestep this
            // check naturally because they only end up here via the
            // linksReady>=required gate, which their fire() decrements
            // by consuming tokens.
            if (required === 0 && !sess.isTrueSource(node)) {
                if (firedSignalOnly.has(node)) continue;
                firedSignalOnly.add(node);
            }

            yield node;

            // If the node still has tokens on every gating slot, it's
            // ready to fire again on the next pop. This is what makes
            // loops work: an upstream that published N times left N
            // tokens queued; each fire consumes one and the node
            // refires until the queue is empty.
            //
            // The `linksReady > 0` guard is what stops required=0
            // sources (StartNode, MakeArray, etc.) from re-enqueuing
            // forever: they have no gating inputs (readyCount stays
            // at 0 across fires), so the criterion `0 >= 0` would
            // otherwise create an infinite loop. Loop-mode dispatch
            // (multi-token gating inputs) goes through the > 0 branch
            // because at least one buffer remains non-empty.
            if (state.linksReady > 0 && state.linksReady >= required) {
                queue.push(node);
            }
        }
    }

    public static RunStatic(session: ISession, t: number): void {
        const { order, reasons } = topoSort(session.graph);
        if (reasons.length > 0) {
            throw new Error(`graph is not statically schedulable: ${reasons.join("; ")}`);
        }
        // Static mode: pull-style. Each node is visited exactly once.
        // For each node, drain its publish events from the session
        // queue first (so any seeded delayed channels deliver their
        // tokens into the input buffers) and then attempt fire.
        const sess = session as Session;
        // Flush any LinkRefs that were sitting on the queue (e.g. from
        // Session.reset's delayed-channel seeding).
        const pending = sess.queue.splice(0, sess.queue.length);
        for (const item of pending) {
            if (isLinkRef(item)) sess.deliverLinkRef(item);
        }
        for (const node of order) {
            node.processControlInputs?.(session);
            if (!node.enabled) continue;
            // Drain any LinkRefs published by an earlier node fire.
            const newRefs = sess.queue.splice(0, sess.queue.length);
            for (const item of newRefs) {
                if (isLinkRef(item)) sess.deliverLinkRef(item);
            }
            if (!node.isReady(session)) continue;
            node.fire(session, t);
        }
        // Final drain so the post-last-node publishes land on the
        // input buffers of any consumer (useful for sub-graph ports).
        const tail = sess.queue.splice(0, sess.queue.length);
        for (const item of tail) {
            if (isLinkRef(item)) sess.deliverLinkRef(item);
        }
        // t is read by node.fire; declare it used.
        void t;
    }

    private static readonly activeAsyncSessions = new WeakSet<ISession>();

    public static async RunStaticAsync(session: ISession, t: number, options: IStaticRunOptions = {}): Promise<void> {
        if (Scheduler.activeAsyncSessions.has(session)) {
            throw new Error("This session already has an active static async traversal");
        }
        const all = Scheduler.GetStaticOrder(session.graph);
        if (options.nodes) {
            const known = new Set(all);
            for (const node of options.nodes) {
                if (!known.has(node)) throw new Error("Static traversal scope contains a node outside the session graph");
            }
        }
        const order = options.nodes ? all.filter(node => options.nodes!.has(node)) : all;
        const sess = session as Session;
        const deliverPending = async (): Promise<void> => {
            const pending = sess.queue.splice(0, sess.queue.length);
            const refs = pending.filter(isLinkRef);
            if (refs.length === 0) return;
            if (session.deliverLinkRefsAsync) await session.deliverLinkRefsAsync(refs, t);
            else for (const ref of refs) sess.deliverLinkRef(ref);
        };
        Scheduler.activeAsyncSessions.add(session);
        try {
            await deliverPending();
            for (const node of order) {
                await deliverPending();
                node.processControlInputs?.(session);
                if (!node.enabled || !node.isReady(session)) continue;
                await node.fireAsync(session, t);
            }
            await deliverPending();
        } finally {
            Scheduler.activeAsyncSessions.delete(session);
        }
    }

    public static CheckStaticEligible(graph: IRuntimeGraph): IStaticEligibility {
        const { reasons } = topoSort(graph);
        return {
            eligible: reasons.length === 0,
            reasons,
        };
    }

    public static GetStaticOrder(graph: IRuntimeGraph): IRuntimeNode[] {
        const { order, reasons } = topoSort(graph);
        if (reasons.length > 0) {
            throw new Error(`graph is not statically schedulable: ${reasons.join("; ")}`);
        }
        return order;
    }
}

// Helpers re-exported for documentation cross-references; not used here directly.
export { isControlSlot, inSlotOf };
