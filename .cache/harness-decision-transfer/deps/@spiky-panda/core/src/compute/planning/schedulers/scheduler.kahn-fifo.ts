// ═══════════════════════════════════════════════════════════════════════════
// Kahn-FIFO scheduler : deterministic topological order driven by a
// first-in / first-out ready queue. Matches the order the existing
// `readyQueueDispatch` runtime drives today, so plans built with this
// scheduler are runtime-faithful.
//
// Cycle detection : if the resulting order does not cover every node,
// the graph is not a DAG and the scheduler throws. Compute graphs are
// DAGs by construction (RNN state is handled outside the link graph).
// ═══════════════════════════════════════════════════════════════════════════

import type { IComputeGraph, IDataLink, IKernel } from "../../compute.interfaces";
import type { IScheduler } from "../planning.interfaces";

export class KahnFifoScheduler implements IScheduler {
    public readonly name = "kahn-fifo";

    public linearize(graph: IComputeGraph): IKernel[] {
        const inDegree = new Map<IKernel, number>();
        for (const node of graph.nodes) {
            const incoming = node.opsc<IDataLink>().filter((l) => l.enabled !== false);
            inDegree.set(node, incoming.length);
        }

        const queue: IKernel[] = [];
        for (const node of graph.nodes) {
            if (inDegree.get(node) === 0) queue.push(node);
        }

        const result: IKernel[] = [];
        while (queue.length > 0) {
            const node = queue.shift()!;
            result.push(node);

            const outgoing = node.onsc<IDataLink>().filter((l) => l.enabled !== false);
            for (const link of outgoing) {
                const target = link.ofin as IKernel | null;
                if (!target) continue;
                const d = (inDegree.get(target) ?? 0) - 1;
                inDegree.set(target, d);
                if (d === 0) queue.push(target);
            }
        }

        if (result.length !== graph.nodes.length) {
            const missing = graph.nodes.length - result.length;
            throw new Error(`KahnFifoScheduler: cycle or disconnected component detected (${missing} unresolved node(s)).`);
        }

        return result;
    }
}
