import { IGraph } from "../../../graph";
import { INeuron, ISynapse } from "../../nn.interfaces";
import type { IBackpropNeuronContext } from "./training/mlp.training.interfaces";
import type { IBackpropSynapseContext } from "../../nn.training";

/// <summary>
/// Represents an activation function and its derivative.
/// The derivative is expected to receive the activation output (f(x)), not the pre-activation input (x).
/// </summary>
export interface IActivationFunction {
    fn: (x: number) => number;
    derivative: (y: number) => number;
}

export interface IInferenceNeuronContext {
    sum: number;
    activation: number;
    remainingInputs: number;
    totalInputs: number;
}

/// <summary>
/// Represents a neuron in a Multi-Layer Perceptron (MLP).
/// It exposes its own state directly and includes a configurable bias.
/// </summary>
export interface IMlpNeuron extends INeuron<IBackpropNeuronContext> {
    /// <summary>Bias added before applying the activation function</summary>
    bias: number;
    /// <summary>Optional activation function (default = ReLU)</summary>
    activationFn?: IActivationFunction;
}

/// <summary>
/// Type guard to check whether an object is an IMlpNeuron
/// </summary>
export function isMlpNeuron(obj: unknown): obj is IMlpNeuron {
    return typeof obj === "object" && obj !== null && "bias" in obj && "activationFn" in obj;
}

/// <summary>
/// Represents a synapse (connection) in an MLP network.
/// </summary>
export interface IMlpSynapse extends ISynapse<IBackpropSynapseContext> {}

/// <summary>
/// A complete MLP graph composed of neurons and synapses.
/// </summary>
export interface IMlpGraph extends IGraph<IMlpNeuron, IMlpSynapse> {}
