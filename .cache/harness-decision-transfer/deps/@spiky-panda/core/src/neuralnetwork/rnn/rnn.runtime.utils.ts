import { ILstmNeuron, IGruNeuron, IRnnNeuron, ILstmInferenceContext, IGruInferenceContext, IRnnSimpleContext } from "./rnn.interfaces";

/// <summary>
/// Utility methods for RNN inference and training context management.
/// </summary>
export class RnnRuntimeUtils {
    /// <summary>
    /// Resets the gate accumulators on an LSTM neuron for a new timestep.
    /// Does NOT reset hiddenState/cellState (they persist between timesteps).
    /// </summary>
    public static resetLstmContext(neuron: ILstmNeuron): void {
        const ctx: ILstmInferenceContext = (neuron.bag as ILstmInferenceContext) ?? {
            sum_f: 0,
            sum_i: 0,
            sum_c: 0,
            sum_o: 0,
            forgetGate: 0,
            inputGate: 0,
            cellCandidate: 0,
            outputGate: 0,
            cellState: 0,
            activation: 0,
        };
        ctx.sum_f = 0;
        ctx.sum_i = 0;
        ctx.sum_c = 0;
        ctx.sum_o = 0;
        ctx.forgetGate = 0;
        ctx.inputGate = 0;
        ctx.cellCandidate = 0;
        ctx.outputGate = 0;
        neuron.bag = ctx;
    }

    /// <summary>
    /// Resets the gate accumulators on a GRU neuron for a new timestep.
    /// Does NOT reset hiddenState (it persists between timesteps).
    /// </summary>
    public static resetGruContext(neuron: IGruNeuron): void {
        const ctx: IGruInferenceContext = (neuron.bag as IGruInferenceContext) ?? {
            sum_r: 0,
            sum_z: 0,
            sum_h: 0,
            resetGate: 0,
            updateGate: 0,
            candidate: 0,
            activation: 0,
        };
        ctx.sum_r = 0;
        ctx.sum_z = 0;
        ctx.sum_h = 0;
        ctx.resetGate = 0;
        ctx.updateGate = 0;
        ctx.candidate = 0;
        neuron.bag = ctx;
    }

    /// <summary>
    /// Resets a simple neuron context (input/output neurons).
    /// </summary>
    public static resetSimpleContext(neuron: IRnnNeuron): void {
        const ctx: IRnnSimpleContext = (neuron.bag as IRnnSimpleContext) ?? {
            activation: 0,
            sum: 0,
            remainingInputs: 0,
            totalInputs: 0,
        };
        const numInputs = neuron.opsc()?.length ?? 0;
        ctx.activation = 0;
        ctx.sum = 0;
        ctx.remainingInputs = numInputs;
        ctx.totalInputs = numInputs;
        neuron.bag = ctx;
    }

    /// <summary>
    /// Resets context based on neuron type.
    /// </summary>
    public static resetContext(neuron: IRnnNeuron): void {
        if ("cellState" in neuron) {
            RnnRuntimeUtils.resetLstmContext(neuron as ILstmNeuron);
        } else if ("biasReset" in neuron) {
            RnnRuntimeUtils.resetGruContext(neuron as IGruNeuron);
        } else {
            RnnRuntimeUtils.resetSimpleContext(neuron);
        }
    }
}
