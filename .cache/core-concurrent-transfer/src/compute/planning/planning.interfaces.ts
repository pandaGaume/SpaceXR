// ═══════════════════════════════════════════════════════════════════════════
// Planning interfaces : memory & schedule planning for IComputeGraph.
//
// The planning layer turns a built ComputeGraph into:
//   1. an ordered schedule (which kernel fires when),
//   2. a per-tensor memory layout (where each transient lives in a shared
//      arena),
// without touching the runtime execution path. The artefact, an
// `IAllocationPlan`, is consumed by:
//   - the memory-viz sample (visual analysis of policies),
//   - eventual sidecar `.cmplan` export for CyanMycelium,
//   - eventual plan-driven `ComputeGraph.infer` (Phase 1+).
//
// All planning is pure: strategies and schedulers work on
// `ITensorLifetime[]` (a projection of the graph) without touching
// `ITensor.data` or running inference.
// ═══════════════════════════════════════════════════════════════════════════

import type { IComputeGraph, IKernel } from "../compute.interfaces";

// ─── Dtype + byte size ───────────────────────────────────────────────────────

/**
 * Element dtype used to compute tensor byte sizes. SpikyPanda's runtime
 * payload is always Float32Array today; int8 / int32 entries are listed
 * so the planner can right-size quantized buffers when CyanMycelium-bound
 * exports declare them.
 */
export type PlanDType = "float32" | "int32" | "int8" | "uint8";

/** Bytes-per-element for each supported planning dtype. */
export const PLAN_DTYPE_BYTES: Record<PlanDType, number> = {
    float32: 4,
    int32: 4,
    int8: 1,
    uint8: 1,
};

// ─── Lifetimes (graph projection) ────────────────────────────────────────────

/**
 * One transient tensor in the planning view of a graph.
 *
 * A tensor is identified by `(producerNodeId, outputIndex)`. Forked
 * outputs (one producer slot, many readers) collapse to a single
 * lifetime with multiple consumers; the death step is the latest fire
 * step among them.
 *
 * Shapes come from `IKernel.outputShapes` and are taken at face value.
 * For graphs with dynamic shapes (batch=N, seqlen=T), the caller is
 * expected to have specialised them via a dummy infer before planning.
 */
export interface ITensorLifetime {
    /** Stable id, conventionally `${producerNodeId}:${outputIndex}`. */
    readonly tensorId: string;

    /** Stringified node id of the producer kernel. */
    readonly producerId: string;

    /** Stringified node ids of all distinct consumer kernels. */
    readonly consumerIds: readonly string[];

    /** Which output slot of the producer this tensor is. 0 for single-output ops. */
    readonly outputIndex: number;

    /** Step in the schedule at which the producer fires. */
    readonly birthStep: number;

    /**
     * Step in the schedule at which the last consumer fires.
     * Equals `birthStep` for sink outputs (no consumer).
     */
    readonly deathStep: number;

    /** Tensor shape as recorded on the producing kernel. */
    readonly shape: readonly number[];

    /** Element dtype for byte sizing. */
    readonly dtype: PlanDType;

    /** Tensor size in bytes, derived from shape * dtype. */
    readonly bytes: number;
}

// ─── Allocation plan ─────────────────────────────────────────────────────────

/**
 * A single tensor's placement in the planned arena. The runtime
 * (TS or CyanMycelium) reads `offset` to decide where the tensor
 * data physically lives during inference.
 */
export interface IAllocation {
    readonly tensorId: string;
    readonly offset: number;
    readonly bytes: number;
    /** Hint for multi-region runtimes (ESP32 SRAM vs PSRAM). Optional. */
    readonly region?: "sram" | "psram";
}

/**
 * Full plan for a single inference path: ordered schedule plus
 * per-tensor offsets.
 */
export interface IAllocationPlan {
    /** Kernel ids in firing order. */
    readonly schedule: readonly string[];

    /** Tensor id → allocation slot. Lookup is O(1) at runtime. */
    readonly allocations: ReadonlyMap<string, IAllocation>;

    /**
     * Maximum arena size needed by this plan (`max(offset+bytes)` over
     * all allocations). What the runtime allocates up-front.
     */
    readonly peakBytes: number;

    /**
     * Theoretical lower bound on arena size: `max over steps S of the
     * sum of bytes of tensors alive at S`. Useful as a reference;
     * `peakBytes / minBound - 1` is the overhead the strategy incurs.
     */
    readonly minBound: number;

    /** Strategy + scheduler names + free-form metadata. */
    readonly metadata: {
        readonly strategy: string;
        readonly scheduler: string;
        readonly targetCapacity?: number;
    };
}

// ─── Strategy + scheduler contracts ──────────────────────────────────────────

/**
 * Allocation strategy: takes the lifetime view and a schedule, returns
 * a placement. Pure function, no shared state.
 */
export interface IAllocationStrategy {
    /** Stable identifier surfaced in plan metadata and UIs. */
    readonly name: string;

    plan(lifetimes: readonly ITensorLifetime[], schedule: readonly string[]): IAllocationPlan;
}

/**
 * Scheduler: produces a topological order over an IComputeGraph. Pure
 * function. Caller resolves IKernel references back from the returned
 * string ids using the same `nodeIdOf` helper used when extracting
 * lifetimes.
 */
export interface IScheduler {
    readonly name: string;

    linearize(graph: IComputeGraph): readonly IKernel[];
}
