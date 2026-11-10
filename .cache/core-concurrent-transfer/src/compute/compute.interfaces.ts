// ═══════════════════════════════════════════════════════════════════════════
// Compute graph interfaces : ONNX-like configurable data flow pipeline
//
// Specialisation of core/execution for tensor-flow graphs. IKernel
// extends IRuntimeNode with the kernel-style execute(inputs[]):outputs[]
// contract; IDataLink narrows IChannel<ITensor> to a numeric slot
// (matches ONNX positional input indexing). ComputeGraph defaults to
// static (Kahn) scheduling, which is the right mode for ONNX inference,
// MPC rollout, and any other DAG of pure compute kernels.
// ═══════════════════════════════════════════════════════════════════════════

import { IChannel, IRuntimeGraph, IRuntimeNode, INodeState } from "../execution/execution.interfaces";
import type { IQuantizationParams } from "../quantization/quantization.interfaces";
import type { IUnitTag } from "../math/math.units";

// ─── Tensor ──────────────────────────────────────────────────────────────────

/**
 * A typed multi-dimensional data container.
 *
 * The fundamental data unit flowing through compute graph edges.
 * Shape describes dimensions (e.g., [36] for a 1D sector grid,
 * [256, 192] for a 2D depth buffer, [9, 9, 2] for a stereo patch pair).
 */
export interface ITensor {
    /** Optional opaque storage; data access on device tensors requires an explicit transfer. */
    readonly storage?: import("./tensor.storage").ITensorStorage;
    /** Raw data. Float32 covers all our numeric use cases. */
    data: Float32Array;

    /** Eligibility hint for content-validated derived-data caches, not an immutability promise. */
    cacheable?: boolean;

    /**
     * Dimensions of the tensor.
     * - `[N]` : 1D vector (e.g., sector depths, MLP input/output)
     * - `[H, W]` : 2D grid (e.g., depth buffer, disparity map)
     * - `[H, W, C]` : 2D with channels (e.g., stereo pair: C=2)
     */
    shape: number[];

    /** Optional name for debugging and graph wiring (e.g., "lidar_sectors", "pose"). */
    name?: string;

    /**
     * Optional quantization metadata. When set, the float values in
     * `data` are a fake-quant representation of an int8 / uint8
     * tensor (i.e. integer-valued, in the domain implied by `params`).
     * Used by import-side QLinear ops in TS to validate quantization
     * numerics without paying the cost of a real int8 runtime; the
     * payload remains Float32Array so the regular FP32 pipeline can
     * still consume / inspect the tensor without changes. Pure-FP32
     * code paths can ignore this field entirely.
     *
     * The "real" int8 representation lives outside the runtime — see
     * `core/quantization/IQuantizedTensor` for that.
     */
    quantization?: IQuantizationParams;

    /**
     * Optional physical-unit tag: the quantity + unit (+ sample rate) of
     * the values in `data`. Set by sensor/source nodes, propagated or
     * transformed by physical ops (e.g. accel->velocity changes the
     * quantity), and READ by verdict nodes (ISO severity) which REFUSE
     * when it is absent rather than guess the unit from amplitude. Pure
     * metadata; FP32 code paths ignore it, exactly like `quantization`.
     * See docs/architecture/unit-tag-convention.md.
     */
    unit?: IUnitTag;
}

// ─── Data link ───────────────────────────────────────────────────────────────

/**
 * A directed edge carrying a tensor between compute nodes.
 *
 * Narrows IChannel<ITensor> by constraining the slot to a number
 * (ONNX-style positional input index). The runtime ILinkState (in the
 * session) holds the actual payload at execution time; the link itself
 * is pure topology + routing metadata.
 */
export interface IDataLink extends IChannel<ITensor> {
    /** Positional index of this link at the consumer node. -1 if unset. */
    readonly slot: number;
    /** Explicit producer output index; omitted for legacy link-order routing. */
    readonly outputIndex?: number;
}

// ─── Compute node ────────────────────────────────────────────────────────────

/**
 * Cached execution context stashed on a compute node's `bag` during
 * fire(). `lastOutputs` lets sink collectors retrieve the per-node
 * output set without re-reading channel state.
 */
export interface IKernelBag {
    /** Cached output tensors from the last fire(). */
    lastOutputs?: ITensor[];
    /** Pre-injected external input tensor for source nodes (set by ComputeGraph.run before session.run). */
    pendingInput?: ITensor;
}

/**
 * A processing stage in the compute graph.
 *
 * Extends IRuntimeNode with the kernel-style execute(inputs[]):outputs[]
 * contract. Kernel provides the fire(session, t) adapter that
 * gathers inputs from incoming channels (via session.consume), calls
 * execute(), and publishes outputs to outgoing channels (via session
 * .publish), so concrete ops stay agnostic of the session API.
 *
 * Node types:
 * - **Source**: no inputs, produces data (e.g., ExternalInputNode).
 *   Receives its tensor via bag.pendingInput before session.run.
 * - **Transform**: inputs -> outputs (e.g., ConvNode, MlpNode).
 *   Inputs are gathered from opsc() in slot-sorted order.
 * - **Sink**: terminal node whose lastOutputs are collected by run().
 */
/** Inputs and results for an explicitly supplied native session. */
export interface IKernelNodeState extends INodeState, IKernelBag {
    sessionOwnedIO?: boolean;
}

/** Optional native execution state. Direct kernel calls can omit it and remain stateless. */
export interface IKernelExecutionContext {
    readonly nodeState: INodeState | undefined;
}

export interface IKernel extends IRuntimeNode<IKernelBag> {
    /**
     * Human-readable node type for debugging (e.g., "lidar_source", "convolution").
     */
    readonly nodeType: string;

    /**
     * Expected shape of each output tensor.
     * Used by the graph builder to validate connectivity.
     * One shape per output (most nodes have a single output).
     */
    readonly outputShapes: number[][];
    /** Optional tensor names in producer-output order, used by importers. */
    readonly outputNames?: ReadonlyArray<string>;

    /**
     * Execute this compute node synchronously.
     *
     * For **source nodes** (no incoming links): `inputs` is empty or
     * contains the pre-injected external tensor.
     * For **transform nodes**: `inputs` are the tensors from incoming
     * IDataLinks, ordered by their slot index.
     *
     * @param inputs  Input tensors from upstream nodes.
     * @returns       Output tensors to be written to outgoing IDataLinks.
     */
    execute(inputs: ITensor[], context?: IKernelExecutionContext): ITensor[];

    /**
     * Optional async execution for nodes that require it (GPU, ONNX
     * runtime, Web Workers). When present, Kernel.fireAsync
     * awaits this; CPU-only nodes do not need to implement it.
     */
    executeAsync?(inputs: ITensor[], context?: IKernelExecutionContext): Promise<ITensor[]>;

    // fireAsync is inherited from IRuntimeNode (mandatory there) and
    // overridden by Kernel to route through executeAsync.
}

// ─── Compute graph ───────────────────────────────────────────────────────────

/**
 * A directed acyclic graph of compute nodes connected by data links.
 *
 * Pure typing narrow of IRuntimeGraph<IKernel, IDataLink>: no own
 * members. run() / runAsync() come from ITickable via IRuntimeGraph; the
 * named-tensor convenience (infer / inferAsync, returning Map<string,
 * ITensor>) lives on the concrete ComputeGraph class only.
 */
export interface IComputeGraph extends IRuntimeGraph<IKernel, IDataLink> {
    // no own members; pure typing narrow.
}
