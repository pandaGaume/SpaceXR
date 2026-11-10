import { IGraph } from "../../graph";
import { INeuron, ISynapse } from "../nn.interfaces";
import { IActivationFunction } from "../ann/mlp/mlp.interfaces";

/// <summary>
/// RNN cell types supported by the framework.
/// </summary>
export enum RnnCellType {
    LSTM = "lstm",
    GRU = "gru",
}

// ---------------------------------------------------------------------------
// Neuron interfaces
// ---------------------------------------------------------------------------

/// <summary>
/// Base interface for all RNN neurons. Extends INeuron with persistent hidden state
/// that carries information between timesteps. The B generic typed-bag carries the
/// per-cell inference context (LSTM, GRU, or simple) stored in neuron.bag.
/// </summary>
export interface IRnnNeuron<B = unknown> extends INeuron<B> {
    cellType: RnnCellType;
    /// <summary>Hidden state h(t-1), persists between timesteps</summary>
    hiddenState: number;
    /// <summary>Clear memory for a new sequence</summary>
    resetState(): void;
}

/// <summary>
/// LSTM neuron with 4 gates (forget, input, candidate, output) and a cell state.
/// The cell state acts as long-term memory, regulated by the gates.
/// </summary>
export interface ILstmNeuron extends IRnnNeuron<ILstmInferenceContext> {
    /// <summary>Cell state c(t-1), LSTM-specific long-term memory</summary>
    cellState: number;
    biasForget: number;
    biasInput: number;
    biasCandidate: number;
    biasOutput: number;
}

/// <summary>
/// GRU neuron with 2 gates (reset, update) and a candidate mechanism.
/// Simpler than LSTM with comparable performance on many tasks.
/// </summary>
export interface IGruNeuron extends IRnnNeuron<IGruInferenceContext> {
    biasReset: number;
    biasUpdate: number;
    biasCandidate: number;
}

// ---------------------------------------------------------------------------
// Synapse interfaces
// ---------------------------------------------------------------------------

/// <summary>
/// RNN synapse carrying multiple weights, one per gate.
/// LSTM: [forget, input, candidate, output] (4 weights)
/// GRU: [reset, update, candidate] (3 weights)
/// </summary>
export interface IRnnSynapse extends ISynapse {
    /// <summary>Weight array, one per gate</summary>
    weights: number[];
}

/// <summary>
/// Regular synapse for hidden-to-output connections (single weight).
/// </summary>
export interface IRnnOutputSynapse extends ISynapse {
    weight: number;
}

// ---------------------------------------------------------------------------
// Graph
// ---------------------------------------------------------------------------

export type IRnnGraph = IGraph<IRnnNeuron, ISynapse>;

// ---------------------------------------------------------------------------
// Inference contexts (stored in neuron.bag)
// ---------------------------------------------------------------------------

/// <summary>
/// LSTM inference context stored in neuron.bag during forward pass.
/// Contains gate accumulators and computed gate values for the current timestep.
/// </summary>
export interface ILstmInferenceContext {
    /// Gate accumulators (weighted sums before activation)
    sum_f: number;
    sum_i: number;
    sum_c: number;
    sum_o: number;
    /// Computed gate values
    forgetGate: number;
    inputGate: number;
    cellCandidate: number;
    outputGate: number;
    /// State
    cellState: number;
    activation: number;
}

/// <summary>
/// GRU inference context stored in neuron.bag during forward pass.
/// </summary>
export interface IGruInferenceContext {
    /// Gate accumulators
    sum_r: number;
    sum_z: number;
    sum_h: number;
    /// Computed gate values
    resetGate: number;
    updateGate: number;
    candidate: number;
    /// State
    activation: number;
}

/// <summary>
/// Simple context for input and output neurons (no gates).
/// </summary>
export interface IRnnSimpleContext {
    activation: number;
    sum: number;
    remainingInputs: number;
    totalInputs: number;
}

// ---------------------------------------------------------------------------
// Builder config
// ---------------------------------------------------------------------------

/// <summary>
/// Configuration for building an RNN network.
/// </summary>
export interface IRnnConfig {
    inputSize: number;
    hiddenSize: number;
    outputSize: number;
    cellType: RnnCellType;
    outputActivation?: IActivationFunction;
}
