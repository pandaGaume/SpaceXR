// ═══════════════════════════════════════════════════════════════════════════
// ComputeGraph : DAG of compute nodes executed via core/execution.
//
// Thin specialisation of RuntimeGraph<IKernel, IDataLink> that
//   - defaults to mode="static" (DAG of pure kernels = Kahn topo),
//   - injects externalInputs onto source nodes' bag.pendingInput before
//     running, so Kernel.fire can pick them up,
//   - collects the named-output Map from sink nodes' bag.lastOutputs.
//
// Concrete op nodes (ONNX ops, MLP/CNN/RNN/Conv/Concat/etc.) only
// implement execute(); the fire(session, t) adapter in Kernel
// handles the session-side wiring.
// ═══════════════════════════════════════════════════════════════════════════

import { Channel } from "../execution/execution.channel";
import { RuntimeGraph } from "../execution/execution.graph";
import { ISession, SchedulingMode } from "../execution/execution.interfaces";
import { INode } from "../graph/graph.interfaces";
import { cloneable } from "../graph/graph.interfaces";
import { IComputeGraph, IKernel, IDataLink, ITensor, IKernelNodeState } from "./compute.interfaces";

// ─── DataLink implementation ─────────────────────────────────────────────────

/**
 * Concrete data link: a directed edge carrying a tensor. Narrows
 * Channel<ITensor> by typing slot as number (the ONNX positional input
 * index). Defaults: not delayed, no initialValue, enabled.
 */
export class DataLink extends Channel<ITensor> implements IDataLink {
    public override readonly slot: number;
    @cloneable public readonly outputIndex?: number;

    public constructor(from?: IKernel, to?: IKernel, inputIndex = -1, outputIndex?: number) {
        super(from as INode | undefined, to as INode | undefined, inputIndex);
        this.slot = inputIndex;
        this.outputIndex = outputIndex;
    }
}

// ─── ComputeGraph implementation ─────────────────────────────────────────────

/**
 * Executable compute graph.
 *
 * Extends RuntimeGraph<IKernel, IDataLink>, inheriting the
 * autonomous run() / runAsync() pair (ITickable) from there. Adds the
 * named-tensor convenience: infer(inputs) / inferAsync(inputs) inject
 * named external tensors onto source nodes' bag, drive one tick, and
 * collect named outputs from sink nodes' bag.
 *
 * Defaults to mode="static" because a compute graph is by construction
 * an acyclic DAG of pure kernels; pass another mode if you have a use
 * case for it.
 *
 * **Usage (named-tensor, ONNX-style):**
 * ```typescript
 * const graph = new ComputeGraph(nodes, links);
 * const result = graph.infer(new Map([["pose", poseTensor]]));
 * const command = result.get("command");
 * ```
 *
 * **Usage (generic, via inherited run()):**
 * ```typescript
 * graph.session.setInput(idx, tensor);
 * graph.run(0);
 * const out = graph.session.getOutput(outIdx);
 * ```
 */
export class ComputeGraph extends RuntimeGraph<IKernel, IDataLink> implements IComputeGraph {
    public constructor(nodes: IKernel[], links: IDataLink[], mode: SchedulingMode = "static") {
        super(nodes, links, mode);
    }

    /**
     * Named-tensor inference convenience: inject inputs by source-node
     * id/tag, drive one tick on the default or explicitly supplied session, collect outputs
     * keyed by tensor.name (or sink id/tag/nodeType fallback).
     */
    public infer(externalInputs?: Map<string, ITensor>, session?: ISession): Map<string, ITensor> {
        this._injectExternalInputs(externalInputs, session);
        this.run(0, session);
        return this._collectResults(session);
    }

    /**
     * Async variant of infer(). Walks the topological order awaiting
     * each node's fireAsync (falling back to fire when not provided).
     */
    public async inferAsync(externalInputs?: Map<string, ITensor>, session?: ISession): Promise<Map<string, ITensor>> {
        this._injectExternalInputs(externalInputs, session);
        await this.runAsync(0, session);
        return this._collectResults(session);
    }

    // ── Internal helpers ───────────────────────────────────────────────────

    /**
     * Inject external tensors into native session state when supplied, or the legacy source bag.
     * Kernel.fire pulls from bag.pendingInput when the node
     * has no incoming channels.
     */
    private _injectExternalInputs(externalInputs?: Map<string, ITensor>, session?: ISession): void {
        if (session && session.graph !== this) throw new Error("Inference session belongs to another graph");
        if (session) for (const node of this.nodes) {
            const state = session.nodeStateOf(node) as IKernelNodeState | undefined;
            if (state) state.sessionOwnedIO = true;
        }
        if (!externalInputs) {
            return;
        }
        for (const node of this.inputs) {
            const key = (node.id as string) ?? node.tag;
            if (key && externalInputs.has(key)) {
                if (session) {
                    const state = session.nodeStateOf(node) as IKernelNodeState | undefined;
                    if (state) state.pendingInput = externalInputs.get(key);
                } else {
                    const bag = node.bag ?? {};
                    bag.pendingInput = externalInputs.get(key);
                    node.bag = bag;
                }
            }
        }
    }

    /**
     * Collect output tensors from sink nodes' bag.lastOutputs into the
     * named-output Map. Keyed by tensor.name when set, else by sink
     * node id / tag / nodeType.
     */
    private _collectResults(session?: ISession): Map<string, ITensor> {
        const result = new Map<string, ITensor>();
        for (const node of this.outputs) {
            const bag = session ? session.nodeStateOf(node) as IKernelNodeState | undefined : node.bag;
            if (!bag?.lastOutputs) {
                continue;
            }
            const fallbackKey = (node.id as string) ?? node.tag ?? node.nodeType;
            for (const tensor of bag.lastOutputs) {
                result.set(tensor.name ?? fallbackKey, tensor);
            }
        }
        return result;
    }
}
