import { ActivationFunctions } from "../../ann/mlp/mlp.activation";
import { ISynapse } from "../../nn.interfaces";
import { ILossFunction, IOptimizer, ITrainingContext } from "../../nn.training";
import { IRnnGraph, ILstmNeuron, IGruNeuron, IRnnNeuron } from "../rnn.interfaces";
import { RnnSynapse } from "../rnn.synapse";
import { RnnInferenceRuntime } from "../rnn.inference";
import { ILstmTimestepState, IGruTimestepState, IRnnSynapseGradients } from "./rnn.training.interfaces";
import { Synapse } from "../../nn.synapse";

const sigmoidDeriv = ActivationFunctions.sigmoid.derivative;
const tanhFn = ActivationFunctions.tanh.fn;
const tanhDeriv = ActivationFunctions.tanh.derivative;

/// <summary>
/// BPTT (Backpropagation Through Time) training runtime for RNN networks.
///
/// Supports both LSTM and GRU cell types. Implements truncated BPTT
/// where gradients are propagated back through at most maxBpttSteps timesteps
/// to avoid exploding gradients.
///
/// Usage:
///   const trainer = new RnnTrainingRuntime(graph, runtime, LossFunctions.MSE, 0.001, Optimizers.Adam());
///   const loss = trainer.trainStep(
///       [[0.5, 0.3], [0.8, 0.1]],  // sequence of inputs
///       [[0.0], [1.0]]              // expected outputs per timestep
///   );
/// </summary>
export class RnnTrainingRuntime {
    private _context: ITrainingContext = { iteration: 0 };
    private _synapseGradients: Map<ISynapse, IRnnSynapseGradients> = new Map();

    public constructor(
        public readonly graph: IRnnGraph,
        public readonly runtime: RnnInferenceRuntime,
        public readonly lossFn: ILossFunction,
        public readonly learningRate: number,
        public readonly optimizer: IOptimizer,
        public readonly maxBpttSteps: number = 10
    ) {}

    /// <summary>
    /// Train on a single sequence. Returns the total loss.
    /// </summary>
    public trainStep(sequence: number[][], targets: number[][]): number {
        if (sequence.length !== targets.length) {
            throw new Error(`Sequence length (${sequence.length}) must match targets length (${targets.length})`);
        }

        const firstHidden = this.graph.hiddens[0] as IRnnNeuron;
        if ("cellState" in firstHidden) {
            return this._trainLstm(sequence, targets);
        } else {
            return this._trainGru(sequence, targets);
        }
    }

    get trainingContext(): Readonly<ITrainingContext> {
        return this._context;
    }

    public deleteContext(): void {
        this._synapseGradients.clear();
        for (const neuron of this.graph.nodes) {
            neuron.bag = undefined;
        }
        for (const syn of this.graph.links) {
            syn.bag = undefined;
        }
    }

    // -----------------------------------------------------------------------
    // LSTM BPTT
    // -----------------------------------------------------------------------
    private _trainLstm(sequence: number[][], targets: number[][]): number {
        const hiddens = this.graph.hiddens as ILstmNeuron[];
        const T = sequence.length;
        const H = hiddens.length;

        // Forward pass: collect states per timestep
        this.runtime.resetState();
        const states: ILstmTimestepState[] = [];

        for (let t = 0; t < T; t++) {
            // Save previous state
            const prevH = hiddens.map((h) => h.hiddenState);
            const prevC = hiddens.map((h) => h.cellState);

            // Forward one step
            const outputs = this.runtime.step(sequence[t]);

            // Capture state from context
            states.push({
                inputs: [...sequence[t]],
                hiddenStates: hiddens.map((h) => h.hiddenState),
                cellStates: hiddens.map((h) => h.cellState),
                prevHiddenStates: prevH,
                prevCellStates: prevC,
                forgetGates: hiddens.map((h) => (h.bag as any).forgetGate),
                inputGates: hiddens.map((h) => (h.bag as any).inputGate),
                cellCandidates: hiddens.map((h) => (h.bag as any).cellCandidate),
                outputGates: hiddens.map((h) => (h.bag as any).outputGate),
                outputs: [...outputs],
            });
        }

        // Compute total loss
        let totalLoss = 0;
        for (let t = 0; t < T; t++) {
            for (let o = 0; o < targets[t].length; o++) {
                totalLoss += this.lossFn.loss(states[t].outputs[o], targets[t][o]);
            }
        }

        // Backward pass (BPTT)
        const inputNeurons = this.graph.inputs as IRnnNeuron[];
        const outputNeurons = this.graph.outputs as IRnnNeuron[];

        // Initialize gradient accumulators for all synapses
        this._initGradients();

        // dh_next and dc_next carry gradients from future timesteps
        let dh_next = new Array(H).fill(0);
        let dc_next = new Array(H).fill(0);

        const startT = Math.max(0, T - this.maxBpttSteps);

        for (let t = T - 1; t >= startT; t--) {
            const st = states[t];

            // Output layer gradients
            const outputActivation = (outputNeurons[0] as any).activationFn ?? ActivationFunctions.sigmoid;
            const dOutputs: number[] = [];
            for (let o = 0; o < targets[t].length; o++) {
                const dLoss = this.lossFn.dLoss(st.outputs[o], targets[t][o]);
                dOutputs.push(dLoss * outputActivation.derivative(st.outputs[o]));
            }

            // Gradient from output to hidden (via hidden->output synapses)
            const dh = [...dh_next]; // Start with gradient from future timesteps

            // Accumulate gradients from output layer
            for (let h = 0; h < H; h++) {
                const hNeuron = hiddens[h];
                const outSynapses = hNeuron.onsc<Synapse>() ?? [];
                for (const syn of outSynapses) {
                    if (syn instanceof RnnSynapse) continue; // Skip recurrent synapses
                    const outIdx = outputNeurons.indexOf(syn.ofin as any);
                    if (outIdx >= 0) {
                        dh[h] += dOutputs[outIdx] * syn.weight;

                        // Accumulate gradient for hidden->output synapse
                        const grad = dOutputs[outIdx] * st.hiddenStates[h];
                        this._accumulateGrad(syn, [grad]);
                    }
                }
            }

            // Accumulate output bias gradients
            for (let o = 0; o < outputNeurons.length; o++) {
                const outNeuron = outputNeurons[o] as any;
                if (outNeuron.bias !== undefined) {
                    outNeuron.bias -= this.learningRate * dOutputs[o];
                }
            }

            // LSTM gate gradients
            const dc = [...dc_next];
            const df = new Array(H).fill(0);
            const di = new Array(H).fill(0);
            const dcc = new Array(H).fill(0);
            const doo = new Array(H).fill(0);

            for (let h = 0; h < H; h++) {
                // dh/d(output_gate) = tanh(c(t)) * dh
                // dc += dh * o * (1 - tanh(c)^2)
                const tanhC = tanhFn(st.cellStates[h]);
                doo[h] = dh[h] * tanhC * sigmoidDeriv(st.outputGates[h]);
                dc[h] += dh[h] * st.outputGates[h] * tanhDeriv(tanhC);

                // dc/d(forget_gate) = c(t-1) * dc
                df[h] = dc[h] * st.prevCellStates[h] * sigmoidDeriv(st.forgetGates[h]);
                // dc/d(input_gate) = c~ * dc
                di[h] = dc[h] * st.cellCandidates[h] * sigmoidDeriv(st.inputGates[h]);
                // dc/d(cell_candidate) = i * dc
                dcc[h] = dc[h] * st.inputGates[h] * tanhDeriv(st.cellCandidates[h]);
            }

            // Accumulate gradients for input->hidden synapses
            for (let inp = 0; inp < inputNeurons.length; inp++) {
                const inpNeuron = inputNeurons[inp];
                const x = st.inputs[inp];
                const outSynapses = inpNeuron.onsc<RnnSynapse>() ?? [];
                for (const syn of outSynapses) {
                    if (!(syn instanceof RnnSynapse)) continue;
                    const target = syn.ofin as ILstmNeuron;
                    const hIdx = hiddens.indexOf(target);
                    if (hIdx < 0) continue;
                    this._accumulateGrad(syn, [df[hIdx] * x, di[hIdx] * x, dcc[hIdx] * x, doo[hIdx] * x]);
                }
            }

            // Accumulate gradients for hidden->hidden (recurrent) synapses
            // and compute dh_next for previous timestep
            dh_next = new Array(H).fill(0);
            dc_next = new Array(H).fill(0);

            for (let hSrc = 0; hSrc < H; hSrc++) {
                const hSrcNeuron = hiddens[hSrc];
                const hPrev = st.prevHiddenStates[hSrc];
                const outSynapses = hSrcNeuron.onsc<RnnSynapse>() ?? [];
                for (const syn of outSynapses) {
                    if (!(syn instanceof RnnSynapse)) continue;
                    const target = syn.ofin as ILstmNeuron;
                    const hTgt = hiddens.indexOf(target);
                    if (hTgt < 0) continue;

                    // Gradient for recurrent weights
                    this._accumulateGrad(syn, [df[hTgt] * hPrev, di[hTgt] * hPrev, dcc[hTgt] * hPrev, doo[hTgt] * hPrev]);

                    // Propagate gradient to previous timestep
                    dh_next[hSrc] += df[hTgt] * syn.weights[0];
                    dh_next[hSrc] += di[hTgt] * syn.weights[1];
                    dh_next[hSrc] += dcc[hTgt] * syn.weights[2];
                    dh_next[hSrc] += doo[hTgt] * syn.weights[3];
                }
            }

            // Cell state gradient to previous timestep
            for (let h = 0; h < H; h++) {
                dc_next[h] = dc[h] * st.forgetGates[h];
            }

            // Accumulate bias gradients
            for (let h = 0; h < H; h++) {
                hiddens[h].biasForget -= this.learningRate * df[h];
                hiddens[h].biasInput -= this.learningRate * di[h];
                hiddens[h].biasCandidate -= this.learningRate * dcc[h];
                hiddens[h].biasOutput -= this.learningRate * doo[h];
            }
        }

        // Apply accumulated gradients
        this._applyGradients();
        this._context.iteration++;

        return totalLoss / T;
    }

    // -----------------------------------------------------------------------
    // GRU BPTT
    // -----------------------------------------------------------------------
    private _trainGru(sequence: number[][], targets: number[][]): number {
        const hiddens = this.graph.hiddens as IGruNeuron[];
        const T = sequence.length;
        const H = hiddens.length;

        // Forward pass
        this.runtime.resetState();
        const states: IGruTimestepState[] = [];

        for (let t = 0; t < T; t++) {
            const prevH = hiddens.map((h) => h.hiddenState);
            const outputs = this.runtime.step(sequence[t]);

            states.push({
                inputs: [...sequence[t]],
                hiddenStates: hiddens.map((h) => h.hiddenState),
                prevHiddenStates: prevH,
                resetGates: hiddens.map((h) => (h.bag as any).resetGate),
                updateGates: hiddens.map((h) => (h.bag as any).updateGate),
                candidates: hiddens.map((h) => (h.bag as any).candidate),
                outputs: [...outputs],
            });
        }

        // Compute total loss
        let totalLoss = 0;
        for (let t = 0; t < T; t++) {
            for (let o = 0; o < targets[t].length; o++) {
                totalLoss += this.lossFn.loss(states[t].outputs[o], targets[t][o]);
            }
        }

        // Backward pass
        const inputNeurons = this.graph.inputs as IRnnNeuron[];
        const outputNeurons = this.graph.outputs as IRnnNeuron[];

        this._initGradients();

        let dh_next = new Array(H).fill(0);
        const startT = Math.max(0, T - this.maxBpttSteps);

        for (let t = T - 1; t >= startT; t--) {
            const st = states[t];

            // Output gradients
            const outputActivation = (outputNeurons[0] as any).activationFn ?? ActivationFunctions.sigmoid;
            const dOutputs: number[] = [];
            for (let o = 0; o < targets[t].length; o++) {
                const dLoss = this.lossFn.dLoss(st.outputs[o], targets[t][o]);
                dOutputs.push(dLoss * outputActivation.derivative(st.outputs[o]));
            }

            // Gradient from output to hidden
            const dh = [...dh_next];
            for (let h = 0; h < H; h++) {
                const hNeuron = hiddens[h];
                const outSynapses = hNeuron.onsc<Synapse>() ?? [];
                for (const syn of outSynapses) {
                    if (syn instanceof RnnSynapse) continue;
                    const outIdx = outputNeurons.indexOf(syn.ofin as any);
                    if (outIdx >= 0) {
                        dh[h] += dOutputs[outIdx] * syn.weight;
                        this._accumulateGrad(syn, [dOutputs[outIdx] * st.hiddenStates[h]]);
                    }
                }
            }

            // Output bias gradients
            for (let o = 0; o < outputNeurons.length; o++) {
                const outNeuron = outputNeurons[o] as any;
                if (outNeuron.bias !== undefined) {
                    outNeuron.bias -= this.learningRate * dOutputs[o];
                }
            }

            // GRU gate gradients
            // h(t) = (1-z)*h(t-1) + z*h~
            // dh/dz = h~ - h(t-1)
            // dh/dh~ = z
            // dh/dh(t-1) = (1-z)
            const dz = new Array(H).fill(0);
            const dhh = new Array(H).fill(0);
            const dr = new Array(H).fill(0);

            for (let h = 0; h < H; h++) {
                // dz = dh * (h~ - h(t-1)) * sigmoid'(z)
                dz[h] = dh[h] * (st.candidates[h] - st.prevHiddenStates[h]) * sigmoidDeriv(st.updateGates[h]);
                // dhh = dh * z * tanh'(h~)
                dhh[h] = dh[h] * st.updateGates[h] * tanhDeriv(st.candidates[h]);
            }

            // dr depends on dhh and recurrent weights (r * h(t-1) * W_candidate)
            // For simplicity, compute dr from the candidate computation
            for (let h = 0; h < H; h++) {
                // The candidate sum includes r*h(t-1)*W, so dr = dhh * h(t-1) * W_candidate * sigmoid'(r)
                // We need the recurrent weights for this
                let recurrentCandidateSum = 0;
                for (let hSrc = 0; hSrc < H; hSrc++) {
                    const hSrcNeuron = hiddens[hSrc];
                    const outSynapses = hSrcNeuron.onsc<RnnSynapse>() ?? [];
                    for (const syn of outSynapses) {
                        if (!(syn instanceof RnnSynapse)) continue;
                        if (syn.ofin !== hiddens[h]) continue;
                        recurrentCandidateSum += st.prevHiddenStates[hSrc] * syn.weights[2];
                    }
                }
                dr[h] = dhh[h] * recurrentCandidateSum * sigmoidDeriv(st.resetGates[h]);
            }

            // Accumulate input->hidden gradients
            for (let inp = 0; inp < inputNeurons.length; inp++) {
                const x = st.inputs[inp];
                const inpNeuron = inputNeurons[inp];
                const outSynapses = inpNeuron.onsc<RnnSynapse>() ?? [];
                for (const syn of outSynapses) {
                    if (!(syn instanceof RnnSynapse)) continue;
                    const target = syn.ofin as IGruNeuron;
                    const hIdx = hiddens.indexOf(target);
                    if (hIdx < 0) continue;
                    this._accumulateGrad(syn, [dr[hIdx] * x, dz[hIdx] * x, dhh[hIdx] * x]);
                }
            }

            // Accumulate recurrent gradients and compute dh_next
            dh_next = new Array(H).fill(0);

            for (let hSrc = 0; hSrc < H; hSrc++) {
                const hPrev = st.prevHiddenStates[hSrc];
                const hSrcNeuron = hiddens[hSrc];
                const outSynapses = hSrcNeuron.onsc<RnnSynapse>() ?? [];
                for (const syn of outSynapses) {
                    if (!(syn instanceof RnnSynapse)) continue;
                    const target = syn.ofin as IGruNeuron;
                    const hTgt = hiddens.indexOf(target);
                    if (hTgt < 0) continue;

                    this._accumulateGrad(syn, [dr[hTgt] * hPrev, dz[hTgt] * hPrev, dhh[hTgt] * st.resetGates[hTgt] * hPrev]);

                    // Propagate to previous timestep
                    dh_next[hSrc] += dr[hTgt] * syn.weights[0];
                    dh_next[hSrc] += dz[hTgt] * syn.weights[1];
                    dh_next[hSrc] += dhh[hTgt] * st.resetGates[hTgt] * syn.weights[2];
                }
            }

            // Add (1-z) * dh to dh_next (direct path from h(t) to h(t-1))
            for (let h = 0; h < H; h++) {
                dh_next[h] += dh[h] * (1 - st.updateGates[h]);
            }

            // Bias gradients
            for (let h = 0; h < H; h++) {
                hiddens[h].biasReset -= this.learningRate * dr[h];
                hiddens[h].biasUpdate -= this.learningRate * dz[h];
                hiddens[h].biasCandidate -= this.learningRate * dhh[h];
            }
        }

        this._applyGradients();
        this._context.iteration++;

        return totalLoss / T;
    }

    // -----------------------------------------------------------------------
    // Gradient management helpers
    // -----------------------------------------------------------------------
    private _initGradients(): void {
        this._synapseGradients.clear();
        for (const syn of this.graph.links) {
            if (syn instanceof RnnSynapse) {
                const numGates = syn.weights.length;
                this._synapseGradients.set(syn, {
                    gradients: new Array(numGates).fill(0),
                    m: new Array(numGates).fill(0),
                    v: new Array(numGates).fill(0),
                });
            } else {
                this._synapseGradients.set(syn, {
                    gradients: [0],
                    m: [0],
                    v: [0],
                });
            }
        }
        // Restore optimizer state from previous iterations
        for (const syn of this.graph.links) {
            const bag = syn.bag as IRnnSynapseGradients | undefined;
            if (bag?.m) {
                const entry = this._synapseGradients.get(syn)!;
                entry.m = [...bag.m];
                entry.v = [...bag.v];
            }
        }
    }

    private _accumulateGrad(syn: ISynapse, grads: number[]): void {
        const entry = this._synapseGradients.get(syn);
        if (!entry) return;
        for (let g = 0; g < Math.min(grads.length, entry.gradients.length); g++) {
            entry.gradients[g] += grads[g];
        }
    }

    private _applyGradients(): void {
        const beta1 = 0.9;
        const beta2 = 0.999;
        const eps = 1e-8;
        const t = this._context.iteration + 1;

        for (const syn of this.graph.links) {
            const entry = this._synapseGradients.get(syn);
            if (!entry) continue;

            if (syn instanceof RnnSynapse) {
                // Apply Adam per gate weight
                for (let g = 0; g < syn.weights.length; g++) {
                    const grad = entry.gradients[g];
                    entry.m[g] = beta1 * entry.m[g] + (1 - beta1) * grad;
                    entry.v[g] = beta2 * entry.v[g] + (1 - beta2) * grad * grad;
                    const mHat = entry.m[g] / (1 - Math.pow(beta1, t));
                    const vHat = entry.v[g] / (1 - Math.pow(beta2, t));
                    syn.weights[g] -= (this.learningRate * mHat) / (Math.sqrt(vHat) + eps);
                }
            } else {
                // Regular synapse (hidden->output)
                const grad = entry.gradients[0];
                entry.m[0] = beta1 * entry.m[0] + (1 - beta1) * grad;
                entry.v[0] = beta2 * entry.v[0] + (1 - beta2) * grad * grad;
                const mHat = entry.m[0] / (1 - Math.pow(beta1, t));
                const vHat = entry.v[0] / (1 - Math.pow(beta2, t));
                syn.weight -= (this.learningRate * mHat) / (Math.sqrt(vHat) + eps);
            }

            // Store optimizer state for next trainStep
            syn.bag = { m: [...entry.m], v: [...entry.v] };
        }
    }
}
