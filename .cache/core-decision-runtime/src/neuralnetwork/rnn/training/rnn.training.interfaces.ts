export type { ILossFunction, IOptimizer, ITrainingContext } from "../../nn.training";

/// <summary>
/// Stored state for one timestep during BPTT forward pass.
/// Captures all gate values and activations needed for backpropagation.
/// </summary>
export interface ILstmTimestepState {
    /// Input values at this timestep
    inputs: number[];
    /// Hidden state h(t)
    hiddenStates: number[];
    /// Cell state c(t)
    cellStates: number[];
    /// Previous hidden state h(t-1)
    prevHiddenStates: number[];
    /// Previous cell state c(t-1)
    prevCellStates: number[];
    /// Gate values per hidden neuron
    forgetGates: number[];
    inputGates: number[];
    cellCandidates: number[];
    outputGates: number[];
    /// Output layer values
    outputs: number[];
}

export interface IGruTimestepState {
    inputs: number[];
    hiddenStates: number[];
    prevHiddenStates: number[];
    resetGates: number[];
    updateGates: number[];
    candidates: number[];
    outputs: number[];
}

/// <summary>
/// Gradient accumulators for RNN synapse weights (per gate).
/// </summary>
export interface IRnnSynapseGradients {
    /// Accumulated gradient per gate weight
    gradients: number[];
    /// Adam first moment per gate
    m: number[];
    /// Adam second moment per gate
    v: number[];
}
