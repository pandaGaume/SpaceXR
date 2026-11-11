// ═══════════════════════════════════════════════════════════════════════════
// readyQueueDispatch : generic dataflow propagation over an IGraph.
//
// Used by neural-network inference runtimes (MLP, CNN, future SNN-batched)
// to factor out the bookkeeping of a remaining-inputs counter + a FIFO
// ready queue. The helper knows nothing about activations, weights, or
// layer types: it manages the counter and queue, delegating per-node
// computation to the caller's callbacks.
//
// Same algorithmic shape as core/execution Scheduler.RunDynamic, but
// operates at the pure topology layer (INode / IOlink) and uses caller-
// owned counters rather than session linksReady state. Scheduler stays
// for the runtime/execution dataflow path; this helper covers the older
// neural-network runtimes that pre-date the execution layer and keep
// their counter on neuron.bag.
// ═══════════════════════════════════════════════════════════════════════════

import { IGraph, INode, IOlink } from "./graph.interfaces";

export interface IReadyQueueDispatchOptions<N extends INode, L extends IOlink> {
    /**
     * Initial set of nodes already ready to fire. Typically the graph's
     * input nodes whose values have just been written. The caller should
     * have already invoked the equivalent of `fire` on each seed entry
     * (i.e. their per-node output is computed) before passing them in,
     * because the helper does not re-fire the seeds.
     */
    readonly seed: ReadonlyArray<N>;

    /**
     * Reads the remaining-inputs counter for a node. Initialised by the
     * caller before invoking the helper (typically set to the number of
     * incoming synapses on each node, zeroed on inputs).
     */
    getCount(node: N): number;

    /**
     * Writes the remaining-inputs counter back. Called once per
     * incoming link delivery to decrement the target's counter.
     */
    setCount(node: N, count: number): void;

    /**
     * Called for every outgoing link of a freshly-fired source. The
     * callback accumulates source's contribution into target's state
     * (typically `target.bag.sum += source.bag.activation * link.weight`).
     */
    propagate(source: N, target: N, link: L): void;

    /**
     * Called when a target's counter reaches zero, i.e. all its inputs
     * have been delivered. The callback finalises the target's state
     * (typically applies bias + activation function).
     */
    fire(node: N): void;
}

/**
 * Run a ready-queue dataflow pass over a graph. Drains the seed FIFO,
 * propagating activations along outgoing links and firing each target
 * as soon as its incoming counter reaches zero. Returns when no more
 * nodes can fire.
 */
export function readyQueueDispatch<N extends INode, L extends IOlink>(graph: IGraph<N, L>, options: IReadyQueueDispatchOptions<N, L>): void {
    void graph; // currently unused: traversal is driven from seed via node.onsc(); kept for future cycle/orphan checks.
    const ready: N[] = [...options.seed];
    while (ready.length > 0) {
        const source = ready.shift()!;
        for (const link of source.onsc<L>()) {
            const target = link.ofin as N | null;
            if (!target) {
                continue;
            }
            options.propagate(source, target, link);
            const remaining = options.getCount(target) - 1;
            options.setCount(target, remaining);
            if (remaining === 0) {
                options.fire(target);
                ready.push(target);
            }
        }
    }
}
