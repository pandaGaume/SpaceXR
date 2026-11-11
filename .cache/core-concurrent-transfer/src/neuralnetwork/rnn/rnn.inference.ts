import { IActivationFunction } from "../ann/mlp/mlp.interfaces";
import { ActivationFunctions } from "../ann/mlp/mlp.activation";
import { Synapse } from "../nn.synapse";
import { IRnnGraph, IRnnNeuron, ILstmNeuron, IGruNeuron, ILstmInferenceContext, IGruInferenceContext } from "./rnn.interfaces";
import { RnnSynapse } from "./rnn.synapse";
import { RnnRuntimeUtils } from "./rnn.runtime.utils";

const sigmoid = ActivationFunctions.sigmoid.fn;
const tanh = ActivationFunctions.tanh.fn;

/// <summary>
/// Inference runtime for RNN networks (LSTM and GRU).
///
/// Unlike MLP inference which processes one input at a time, RNN inference
/// processes sequences of inputs. Hidden state persists between timesteps
/// within a sequence, enabling temporal memory.
///
/// Usage:
///   const runtime = new RnnInferenceRuntime(graph);
///   runtime.resetState();
///   const outputs = runtime.run([[0.5, 0.3], [0.8, 0.1], [0.2, 0.9]]);
///   // outputs[0] = output at t=0, outputs[1] = output at t=1, etc.
/// </summary>
export class RnnInferenceRuntime {
    private _hiddenNeurons: IRnnNeuron[];
    private _inputNeurons: IRnnNeuron[];
    private _outputNeurons: IRnnNeuron[];
    private _outputActivation: IActivationFunction;

    public constructor(
        public readonly graph: IRnnGraph,
        outputActivation?: IActivationFunction
    ) {
        this._inputNeurons = graph.inputs as IRnnNeuron[];
        this._hiddenNeurons = graph.hiddens as IRnnNeuron[];
        this._outputNeurons = graph.outputs as IRnnNeuron[];

        // Determine output activation from the first output neuron if it's an MlpNeuron
        if (outputActivation) {
            this._outputActivation = outputActivation;
        } else if (this._outputNeurons.length > 0 && (this._outputNeurons[0] as any).activationFn) {
            this._outputActivation = (this._outputNeurons[0] as any).activationFn;
        } else {
            this._outputActivation = ActivationFunctions.sigmoid;
        }
    }

    /// <summary>
    /// Process a single timestep. Hidden state persists to the next call.
    /// </summary>
    public step(inputValues: number[]): number[] {
        if (inputValues.length !== this._inputNeurons.length) {
            throw new Error(`Input count mismatch: expected ${this._inputNeurons.length}, got ${inputValues.length}`);
        }

        // Detect cell type from first hidden neuron
        const firstHidden = this._hiddenNeurons[0];
        if ("cellState" in firstHidden) {
            return this._stepLstm(inputValues);
        } else {
            return this._stepGru(inputValues);
        }
    }

    /// <summary>
    /// Process a full sequence, returning outputs for each timestep.
    /// </summary>
    public run(sequence: number[][]): number[][] {
        const outputs: number[][] = [];
        for (const input of sequence) {
            outputs.push(this.step(input));
        }
        return outputs;
    }

    /// <summary>
    /// Reset hidden and cell states for a new sequence.
    /// </summary>
    public resetState(): void {
        for (const neuron of this._hiddenNeurons) {
            neuron.resetState();
        }
    }

    public clearContext(): void {
        for (const neuron of this.graph.nodes) {
            RnnRuntimeUtils.resetContext(neuron);
        }
    }

    public deleteContext(): void {
        for (const neuron of this.graph.nodes) {
            neuron.bag = undefined;
        }
    }

    // -----------------------------------------------------------------------
    // LSTM forward pass for one timestep
    // -----------------------------------------------------------------------
    private _stepLstm(inputValues: number[]): number[] {
        const hiddens = this._hiddenNeurons as ILstmNeuron[];

        // 1. Initialize gate accumulators
        for (const h of hiddens) {
            RnnRuntimeUtils.resetLstmContext(h);
        }

        // 2. Set input activations
        for (let i = 0; i < inputValues.length; i++) {
            this._inputNeurons[i].bag = { activation: inputValues[i] };
        }

        // 3. Accumulate input -> hidden contributions
        for (const inp of this._inputNeurons) {
            const inputAct = (inp.bag as any).activation as number;
            const outSynapses = inp.onsc<RnnSynapse>() ?? [];
            for (const syn of outSynapses) {
                if (!(syn instanceof RnnSynapse)) continue;
                const target = syn.ofin as ILstmNeuron;
                if (!("cellState" in target)) continue;
                const ctx = target.bag as ILstmInferenceContext;
                ctx.sum_f += inputAct * syn.weights[0];
                ctx.sum_i += inputAct * syn.weights[1];
                ctx.sum_c += inputAct * syn.weights[2];
                ctx.sum_o += inputAct * syn.weights[3];
            }
        }

        // 4. Accumulate hidden -> hidden (recurrent) contributions using h(t-1)
        for (const hSrc of hiddens) {
            const hPrev = hSrc.hiddenState;
            const outSynapses = hSrc.onsc<RnnSynapse>() ?? [];
            for (const syn of outSynapses) {
                if (!(syn instanceof RnnSynapse)) continue;
                const target = syn.ofin as ILstmNeuron;
                if (!("cellState" in target)) continue;
                const ctx = target.bag as ILstmInferenceContext;
                ctx.sum_f += hPrev * syn.weights[0];
                ctx.sum_i += hPrev * syn.weights[1];
                ctx.sum_c += hPrev * syn.weights[2];
                ctx.sum_o += hPrev * syn.weights[3];
            }
        }

        // 5. Compute gates and update states
        for (const h of hiddens) {
            const ctx = h.bag as ILstmInferenceContext;
            ctx.forgetGate = sigmoid(ctx.sum_f + h.biasForget);
            ctx.inputGate = sigmoid(ctx.sum_i + h.biasInput);
            ctx.cellCandidate = tanh(ctx.sum_c + h.biasCandidate);
            ctx.outputGate = sigmoid(ctx.sum_o + h.biasOutput);

            // Update cell state: c(t) = f * c(t-1) + i * c~
            const newCellState = ctx.forgetGate * h.cellState + ctx.inputGate * ctx.cellCandidate;
            ctx.cellState = newCellState;
            h.cellState = newCellState;

            // Compute hidden output: h(t) = o * tanh(c(t))
            const newHidden = ctx.outputGate * tanh(newCellState);
            ctx.activation = newHidden;
            h.hiddenState = newHidden;
        }

        // 6. Compute output layer
        return this._computeOutputs();
    }

    // -----------------------------------------------------------------------
    // GRU forward pass for one timestep
    // -----------------------------------------------------------------------
    private _stepGru(inputValues: number[]): number[] {
        const hiddens = this._hiddenNeurons as IGruNeuron[];

        // 1. Initialize gate accumulators
        for (const h of hiddens) {
            RnnRuntimeUtils.resetGruContext(h);
        }

        // 2. Set input activations
        for (let i = 0; i < inputValues.length; i++) {
            this._inputNeurons[i].bag = { activation: inputValues[i] };
        }

        // 3. Accumulate input contributions for reset and update gates
        //    Also accumulate input contribution for candidate (before reset gate is applied)
        for (const inp of this._inputNeurons) {
            const inputAct = (inp.bag as any).activation as number;
            const outSynapses = inp.onsc<RnnSynapse>() ?? [];
            for (const syn of outSynapses) {
                if (!(syn instanceof RnnSynapse)) continue;
                const target = syn.ofin as IGruNeuron;
                if (!("biasReset" in target)) continue;
                const ctx = target.bag as IGruInferenceContext;
                ctx.sum_r += inputAct * syn.weights[0];
                ctx.sum_z += inputAct * syn.weights[1];
                ctx.sum_h += inputAct * syn.weights[2];
            }
        }

        // 4. Accumulate hidden(t-1) contributions for reset and update gates
        for (const hSrc of hiddens) {
            const hPrev = hSrc.hiddenState;
            const outSynapses = hSrc.onsc<RnnSynapse>() ?? [];
            for (const syn of outSynapses) {
                if (!(syn instanceof RnnSynapse)) continue;
                const target = syn.ofin as IGruNeuron;
                if (!("biasReset" in target)) continue;
                const ctx = target.bag as IGruInferenceContext;
                ctx.sum_r += hPrev * syn.weights[0];
                ctx.sum_z += hPrev * syn.weights[1];
                // Note: candidate recurrent contribution uses r * h(t-1), computed after gate
            }
        }

        // 5. Compute reset and update gates, then compute candidate with r * h(t-1)
        for (const h of hiddens) {
            const ctx = h.bag as IGruInferenceContext;
            ctx.resetGate = sigmoid(ctx.sum_r + h.biasReset);
            ctx.updateGate = sigmoid(ctx.sum_z + h.biasUpdate);
        }

        // 6. Accumulate recurrent contribution for candidate using r * h(t-1)
        for (const hSrc of hiddens) {
            const hPrev = hSrc.hiddenState;
            const outSynapses = hSrc.onsc<RnnSynapse>() ?? [];
            for (const syn of outSynapses) {
                if (!(syn instanceof RnnSynapse)) continue;
                const target = syn.ofin as IGruNeuron;
                if (!("biasReset" in target)) continue;
                const tCtx = target.bag as IGruInferenceContext;
                // candidate uses reset-gated hidden: r * h(t-1)
                tCtx.sum_h += tCtx.resetGate * hPrev * syn.weights[2];
            }
        }

        // 7. Compute candidate and final hidden state
        for (const h of hiddens) {
            const ctx = h.bag as IGruInferenceContext;
            ctx.candidate = tanh(ctx.sum_h + h.biasCandidate);
            // h(t) = (1 - z) * h(t-1) + z * h~
            const newHidden = (1 - ctx.updateGate) * h.hiddenState + ctx.updateGate * ctx.candidate;
            ctx.activation = newHidden;
            h.hiddenState = newHidden;
        }

        // 8. Compute output layer
        return this._computeOutputs();
    }

    // -----------------------------------------------------------------------
    // Output layer computation (shared between LSTM and GRU)
    // -----------------------------------------------------------------------
    private _computeOutputs(): number[] {
        const outputs: number[] = [];

        for (const outNeuron of this._outputNeurons) {
            let sum = 0;
            const inSynapses = outNeuron.opsc<Synapse>() ?? [];
            for (const syn of inSynapses) {
                const src = syn.oini as IRnnNeuron;
                const srcAct = src.hiddenState !== undefined ? src.hiddenState : ((src.bag as any)?.activation ?? 0);
                sum += srcAct * syn.weight;
            }

            // Add bias if output neuron has one
            if ((outNeuron as any).bias !== undefined) {
                sum += (outNeuron as any).bias;
            }

            const activation = this._outputActivation.fn(sum);
            outNeuron.bag = { activation, sum, remainingInputs: 0, totalInputs: 0 };
            outputs.push(activation);
        }

        return outputs;
    }
}
