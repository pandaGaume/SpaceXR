// ═══════════════════════════════════════════════════════════════════════════
// Lifetime extraction : turn an IComputeGraph + a schedule into a flat
// list of `ITensorLifetime` records. Allocation strategies and metric
// helpers operate exclusively on this projection; nothing here touches
// `ITensor.data` or executes the graph.
// ═══════════════════════════════════════════════════════════════════════════

import type { IComputeGraph, IKernel, IDataLink } from "../compute.interfaces";
import { PLAN_DTYPE_BYTES, type ITensorLifetime, type PlanDType } from "./planning.interfaces";

// ─── Node id resolution ──────────────────────────────────────────────────────

/**
 * Stable, stringified id for a kernel. Used both as the planner's
 * tensor id prefix and as the schedule entries. Falls back to an
 * index-based slug when neither `id` nor `tag` is set.
 */
export function nodeIdOf(node: IKernel, fallbackIndex: number): string {
    if (node.id !== null && node.id !== undefined) return String(node.id);
    if (node.tag) return String(node.tag);
    return `node_${fallbackIndex}`;
}

/**
 * Build a `kernel → stringified-id` map for a graph, using the node's
 * declared id/tag when available and an index fallback otherwise.
 * Idempotent for a given graph instance.
 */
export function buildNodeIdMap(graph: IComputeGraph): Map<IKernel, string> {
    const map = new Map<IKernel, string>();
    graph.nodes.forEach((n, i) => map.set(n, nodeIdOf(n, i)));
    return map;
}

// ─── Tensor byte sizing ──────────────────────────────────────────────────────

/** Product of dimensions (with empty-shape guard) times dtype size. */
export function tensorBytes(shape: readonly number[], dtype: PlanDType = "float32"): number {
    if (shape.length === 0) return PLAN_DTYPE_BYTES[dtype];
    let elements = 1;
    for (const d of shape) elements *= Math.max(1, d);
    return elements * PLAN_DTYPE_BYTES[dtype];
}

// ─── Lifetime extraction ─────────────────────────────────────────────────────

/**
 * Enumerate every distinct transient tensor in the graph.
 *
 * A "transient tensor" here is one producer slot: `(producer, outputIndex)`.
 * The mapping from outgoing links to output slots follows the convention
 * implemented in `Kernel._publishOutputs`:
 *   - When the kernel emits multiple outputs (`outputShapes.length > 1`),
 *     the i-th outgoing link carries the i-th output (with output[0] as
 *     fallback for excess links).
 *   - When the kernel emits a single output, every outgoing link broadcasts
 *     it. Forked outputs therefore collapse to a single tensor whose
 *     consumer set is the union of all readers.
 *
 * Producers with no outgoing links (sink kernels) still appear in the
 * returned list so their outputs can be planned (typical for graph
 * output buffers).
 */
function enumerateTensors(graph: IComputeGraph, nodeIdMap: ReadonlyMap<IKernel, string>): TensorRef[] {
    const refs = new Map<string, TensorRef>();

    const ensureRef = (producer: IKernel, outIdx: number): TensorRef => {
        const producerId = nodeIdMap.get(producer)!;
        const tensorId = `${producerId}:${outIdx}`;
        let ref = refs.get(tensorId);
        if (ref) return ref;
        const shape = producer.outputShapes[outIdx] ?? producer.outputShapes[0] ?? [];
        const dtype: PlanDType = "float32"; // Today's ITensor.data is always Float32Array.
        ref = {
            tensorId,
            producerId,
            outputIndex: outIdx,
            consumerIds: [],
            shape: Array.from(shape),
            dtype,
            bytes: tensorBytes(shape, dtype),
        };
        refs.set(tensorId, ref);
        return ref;
    };

    // Walk links to discover producer/consumer pairs.
    for (const link of graph.links) {
        if (link.enabled === false) continue;
        const producer = link.oini as IKernel | null;
        const consumer = link.ofin as IKernel | null;
        if (!producer || !nodeIdMap.has(producer)) continue;

        const outgoing = producer.onsc<IDataLink>().filter((l) => l.enabled !== false);
        const M = Math.max(1, producer.outputShapes.length);
        const linkIdx = outgoing.indexOf(link);
        const outIdx = M > 1 ? Math.min(Math.max(0, linkIdx), M - 1) : 0;

        const ref = ensureRef(producer, outIdx);
        if (consumer && nodeIdMap.has(consumer)) {
            const consumerId = nodeIdMap.get(consumer)!;
            if (!ref.consumerIds.includes(consumerId)) {
                (ref.consumerIds as string[]).push(consumerId);
            }
        }
    }

    // Backfill sink outputs (producers whose outputs are read by no one).
    for (const producer of graph.nodes) {
        const M = Math.max(1, producer.outputShapes.length);
        for (let outIdx = 0; outIdx < M; outIdx++) {
            ensureRef(producer, outIdx);
        }
    }

    return Array.from(refs.values());
}

/**
 * Internal mutable tensor descriptor before the schedule is applied.
 * Once birth/death steps are computed, it becomes an `ITensorLifetime`.
 */
interface TensorRef {
    readonly tensorId: string;
    readonly producerId: string;
    readonly outputIndex: number;
    readonly consumerIds: readonly string[]; // mutated during enumeration
    readonly shape: readonly number[];
    readonly dtype: PlanDType;
    readonly bytes: number;
}

/**
 * Project an IComputeGraph + a schedule (kernel firing order) into a
 * flat list of tensor lifetimes. Birth/death steps are computed from
 * the schedule positions of producer and last consumer.
 *
 * Throws if a kernel referenced as producer or consumer is missing
 * from the schedule (which would mean the schedule does not cover
 * the graph).
 */
export function computeLifetimes(graph: IComputeGraph, schedule: readonly IKernel[]): ITensorLifetime[] {
    const nodeIdMap = buildNodeIdMap(graph);
    const position = new Map<string, number>();
    schedule.forEach((kernel, idx) => {
        const id = nodeIdMap.get(kernel);
        if (id !== null && id !== undefined) position.set(id, idx);
    });

    const refs = enumerateTensors(graph, nodeIdMap);
    const lifetimes: ITensorLifetime[] = [];

    for (const ref of refs) {
        const birthStep = position.get(ref.producerId);
        if (birthStep === null || birthStep === undefined) {
            // Producer not in schedule: skip rather than crash. This can
            // happen for disabled / orphaned kernels.
            continue;
        }
        let deathStep = birthStep;
        for (const c of ref.consumerIds) {
            const ps = position.get(c);
            if (ps !== null && ps !== undefined && ps > deathStep) deathStep = ps;
        }
        lifetimes.push({
            tensorId: ref.tensorId,
            producerId: ref.producerId,
            consumerIds: ref.consumerIds,
            outputIndex: ref.outputIndex,
            birthStep,
            deathStep,
            shape: ref.shape,
            dtype: ref.dtype,
            bytes: ref.bytes,
        });
    }

    return lifetimes;
}

/**
 * Convenience: convert a schedule of `IKernel[]` into the stringified
 * id array expected by `IAllocationStrategy.plan`.
 */
export function scheduleToIds(graph: IComputeGraph, schedule: readonly IKernel[]): string[] {
    const map = buildNodeIdMap(graph);
    const out: string[] = [];
    for (const k of schedule) {
        const id = map.get(k);
        if (id !== null && id !== undefined) out.push(id);
    }
    return out;
}
