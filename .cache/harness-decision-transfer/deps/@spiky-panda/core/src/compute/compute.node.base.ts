// ═══════════════════════════════════════════════════════════════════════════
// Kernel : abstract base for tensor-flow compute nodes.
//
// Adapts the kernel-style `execute(inputs[]):outputs[]` contract to the
// runtime fire(session, t) contract: gathers inputs from opsc channels
// in slot-sorted order, calls execute, stashes outputs on bag.lastOutputs
// (so sink collection by ComputeGraph.run can find them), publishes
// outputs to onsc channels via session.publish. Concrete op subclasses
// only implement execute() (and optionally executeAsync()).
// ═══════════════════════════════════════════════════════════════════════════

import { IChannel, ISession } from "../execution/execution.interfaces";
import { RuntimeNode } from "../execution/execution.node";
import { IKernel, IKernelBag, IDataLink, ITensor, IKernelExecutionContext, IKernelNodeState } from "./compute.interfaces";

export abstract class Kernel extends RuntimeNode<IKernelBag> implements IKernel {
    public abstract readonly nodeType: string;
    public abstract readonly outputShapes: number[][];
    public readonly outputNames?: ReadonlyArray<string>;

    public abstract execute(inputs: ITensor[], context?: IKernelExecutionContext): ITensor[];
    public executeAsync?(inputs: ITensor[], context?: IKernelExecutionContext): Promise<ITensor[]>;

    /**
     * Adapter: gather inputs (consume from session linkStates in slot
     * order, or read bag.pendingInput for source nodes), execute the
     * kernel, stash outputs on bag.lastOutputs, publish outputs to
     * outgoing channels.
     */
    public override fire(session: ISession, _t: number): void {
        const inputs = this._gatherInputs(session);
        const outputs = this.execute(inputs, { nodeState: session.nodeStateOf(this) });
        this._publishOutputs(session, outputs);
    }

    /**
     * Async variant of fire(): same gather/publish flow but awaits
     * executeAsync when defined. Falls back to the sync execute path.
     */
    public override async fireAsync(session: ISession, _t: number): Promise<void> {
        const inputs = this._gatherInputs(session);
        const context = { nodeState: session.nodeStateOf(this) };
        const outputs = this.executeAsync ? await this.executeAsync(inputs, context) : this.execute(inputs, context);
        this._publishOutputs(session, outputs);
    }

    /**
     * Readiness: the default all-channels-ready gate, plus the classic
     * external-injection path. ComputeGraph.infer() pre-loads source
     * kernels via bag.pendingInput without publishing channel tokens,
     * so a source kernel that gained a boundary input-port channel
     * (a graph embedded as a model node) must stay fireable when only
     * the pending input is present.
     */
    public override isReady(session: ISession): boolean {
        if (super.isReady(session)) {
            return true;
        }
        const state = session.nodeStateOf(this) as IKernelNodeState | undefined;
        const bag = state?.sessionOwnedIO ? state : (this.bag as IKernelBag | undefined);
        return this.enabled && !!bag?.pendingInput;
    }

    public override reset(session: ISession): void {
        const state = session.nodeStateOf(this) as IKernelNodeState | undefined;
        if (state?.sessionOwnedIO) { state.pendingInput = undefined; state.lastOutputs = undefined; }
    }

    // ── internal ───────────────────────────────────────────────────────

    private _gatherInputs(session: ISession): ITensor[] {
        const incoming = this.opsc<IDataLink>();
        const state = session.nodeStateOf(this) as IKernelNodeState | undefined;
        const bag = state?.sessionOwnedIO ? state : (this.bag as IKernelBag | undefined);

        if (incoming.length === 0) {
            // Source node: pull the pre-injected external tensor from
            // bag.pendingInput. ComputeGraph.run stashes it before
            // running the session. pendingInput PERSISTS here on
            // purpose: training loops (CNN/MLP harnesses) inject a
            // sample once and run several forward/backward passes over
            // it, and a channel-less source cannot mix stale external
            // data with streamed tokens anyway. The stale-mixing hazard
            // only exists on boundary-wired kernels, handled below.
            return bag?.pendingInput ? [bag.pendingInput] : [];
        }

        // Transform node: consume each incoming channel in slot order
        // (the ONNX graph builder tags links with their positional
        // input index; arbitrary numeric ordering when not set).
        const links = session.graph.links as ReadonlyArray<IDataLink>;
        // Source ports select outputs; numeric destination ports position inputs.
        const inputSlot = (link: IDataLink): number => typeof link.toSlot === "number" ? link.toSlot : link.slot;
        const hasSlot = incoming.some((l) => inputSlot(l) >= 0);
        const ordered = hasSlot ? [...incoming].sort((a, b) => inputSlot(a) - inputSlot(b)) : incoming;
        const inputs: ITensor[] = [];
        const positional = incoming.some((link) => link.outputIndex !== undefined);
        for (const link of ordered) {
            if (!link.enabled) {
                continue;
            }
            const idx = links.indexOf(link);
            if (idx < 0) {
                continue;
            }
            const tensor = session.consume(idx) as ITensor | undefined;
            if (tensor) {
                if (positional && inputSlot(link) >= 0) inputs[inputSlot(link)] = tensor;
                else inputs.push(tensor);
            }
        }
        if (inputs.length === 0 && bag?.pendingInput) {
            // Boundary-wired source node on the classic infer() path:
            // the dangling input-port channel carries no token, so fall
            // back to the pre-injected external tensor. Channel tokens
            // win when both are present (the streaming path routes a
            // fresh token in before every internal run). Consumed on
            // read, like the source-node branch above: a pendingInput
            // left behind by infer() must not pair with fresh channel
            // tokens on a later partially fed run.
            const pending = bag.pendingInput;
            bag.pendingInput = undefined;
            return [pending];
        }
        return inputs;
    }

    private _publishOutputs(session: ISession, outputs: ITensor[]): void {
        if (this.outputNames)
            outputs = outputs.map((tensor, i) => {
                if (!this.outputNames![i]) return tensor;
                // Preserve tensor implementations with accessors or prototype
                // methods. Naming an output must not materialize its data.
                const named = Object.create(Object.getPrototypeOf(tensor), Object.getOwnPropertyDescriptors(tensor)) as ITensor;
                Object.defineProperty(named, "name", { value: this.outputNames![i], enumerable: true, configurable: true, writable: true });
                return named;
            });
        // Store results in native session state; retain the legacy bag view.
        const state = session.nodeStateOf(this) as IKernelNodeState | undefined;
        if (state) state.lastOutputs = outputs;
        // Stash for sink collection by ComputeGraph._collectResults.
        if (!state?.sessionOwnedIO) {
            const bag = (this.bag ?? {}) as IKernelBag;
            bag.lastOutputs = outputs;
            this.bag = bag;
        }

        // Distribute to outgoing channels. With multiple outputs, the
        // i-th output goes to the i-th outgoing link, falling back to
        // outputs[0] when out of range. With a single output, broadcast
        // to all outgoing links (matches the prior ComputeGraph
        // behaviour).
        const outgoing = this.onsc<IDataLink>();
        const links = session.graph.links as ReadonlyArray<IDataLink>;
        for (let i = 0; i < outgoing.length; i++) {
            const link = outgoing[i];
            if (!link.enabled) {
                continue;
            }
            const idx = links.indexOf(link);
            if (idx < 0) {
                continue;
            }
            const sourceSlot = (link as IChannel).slot;
            const named = typeof sourceSlot === "string" ? outputs.find((tensor) => tensor.name === sourceSlot) : undefined;
            const tensor = link.outputIndex !== undefined ? outputs[link.outputIndex] : (named ?? (outputs.length > 1 ? (outputs[i] ?? outputs[0]) : outputs[0]));
            if (tensor) {
                session.publish(idx, tensor);
            }
        }
    }
}
