// ═══════════════════════════════════════════════════════════════════════════
// NeuralRunner : a RuntimeNode that wraps a neural-network inference runtime
//
// Single concrete IRuntimeNode that exposes a NN family runtime (MLP, CNN,
// RNN) as a node inside a RuntimeGraph or a SimSession. fire() gathers
// number[] payloads from incoming channels (concatenated in slot order),
// invokes the wrapped runtime via the evaluate callback, and publishes
// the resulting number[] on every outgoing channel (broadcast).
//
// State (e.g. RNN hidden/cell state across timesteps) lives on the wrapped
// runtime; the runner stays stateless. Callers wanting to reset such state
// access it via `runner.runtime`.
// ═══════════════════════════════════════════════════════════════════════════

import { IChannel, ISession } from "../execution/execution.interfaces";
import { RuntimeNode } from "../execution/execution.node";

export class NeuralRunner<R = unknown> extends RuntimeNode {
    public constructor(
        /** Underlying NN inference runtime (MLPInferenceRuntime, CnnInferenceRuntime, RnnInferenceRuntime, ...). Exposed for runtime-specific ops (e.g. RNN.resetState()). */
        public readonly runtime: R,
        /** Closure that turns a flat input vector into the runtime's output vector. Lets each family route to its own method (.run, .step, ...). */
        private readonly evaluate: (runtime: R, input: number[]) => number[]
    ) {
        super();
    }

    public override fire(session: ISession, _t: number): void {
        const links = session.graph.links as ReadonlyArray<IChannel>;

        // Gather inputs from opsc channels in slot order, concatenated as
        // a single flat number[].
        const incoming = this.opsc<IChannel>();
        const ordered = [...incoming].sort((a, b) => compareSlot(a.slot, b.slot));
        const flat: number[] = [];
        for (const link of ordered) {
            if (!link.enabled) {
                continue;
            }
            const idx = links.indexOf(link);
            if (idx < 0) {
                continue;
            }
            const value = session.consume(idx);
            if (Array.isArray(value)) {
                flat.push(...(value as number[]));
            } else if (typeof value === "number") {
                flat.push(value);
            }
        }

        const result = this.evaluate(this.runtime, flat);

        // Broadcast the result to every outgoing channel. Multi-channel
        // splitting (per-slot chunks) is left to caller-side runners
        // when needed.
        const outgoing = this.onsc<IChannel>();
        for (const link of outgoing) {
            if (!link.enabled) {
                continue;
            }
            const idx = links.indexOf(link);
            if (idx < 0) {
                continue;
            }
            session.publish(idx, result);
        }
    }
}

function compareSlot(a: string | number, b: string | number): number {
    if (typeof a === "number" && typeof b === "number") {
        return a - b;
    }
    return String(a).localeCompare(String(b));
}
