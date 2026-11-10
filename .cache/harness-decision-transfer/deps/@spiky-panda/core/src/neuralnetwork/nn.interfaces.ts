import { ILinkSet, INode, INodeSet, IOlink } from "../graph";

/// <summary>
/// Represents a generic neuron (node) in a neural network.
/// This interface is extended by specific neuron types (e.g., spiking, activation-based).
/// </summary>
export interface INeuron<B = unknown> extends INode<B> {
    /// <summary>Resets the neuron to its initial state</summary>
    reset(): void;
}

/// <summary>
/// Represents a Layer in a neural network.
/// </summary>
export interface ILayer<N extends INeuron> extends INodeSet<N> {}

export interface ILayerConnection<L extends ISynapse> extends ILinkSet<L> {}

/// <summary>
/// Describes how two neural layers are connected.
/// </summary>
export enum LayerConnectionType {
    /// <summary>
    /// Every neuron in the source layer is connected to every neuron in the target layer.
    /// This is the standard connection in most MLP architectures.
    /// </summary>
    FullyConnected = "fully_connected",

    /// <summary>
    /// Each neuron in the source layer is connected to the neuron with the same index in the target layer.
    /// Requires source and target layers to have the same number of neurons.
    /// </summary>
    OneToOne = "one_to_one",

    Unknown = "unknown",
}

/// <summary>
/// Represents a synapse (link) between two neurons in a network.
/// This interface is extended by specific synapse types (e.g., with weights, delays, STDP).
/// </summary>
export interface ISynapse<B = unknown> extends IOlink<B> {
    /// <summary>Synaptic weight</summary>
    weight: number;
}
