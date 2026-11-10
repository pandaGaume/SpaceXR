import { Nullable } from "../../types";
import { IGraph, INode, isGraph, isNode, isOlink } from "../../graph";
import { INeuron, ISynapse } from "../nn.interfaces";

/**
 * Represents a discrete spike event traveling through the network
 */
export interface ISpike {
    timestamp: number; // Time of the spike
    amplitude: number; // Strength of the spike
    source: INode; // Neuron that emitted the spike
}

/**
 * Represents the internal state of a spiking neuron
 */
export interface ISpikeNeuronState {
    membranePotential: number; // Current charge of the neuron
    lastSpikeTime: Nullable<number>; // Last time the neuron spiked
    spikes: Array<ISpike>; // Spikes emitted by the neuron
}

/**
 * Represents a neuron in the Spiking Neural Network
 */
export interface ISpikeNeuron extends INeuron, ISpikeNeuronState {
    threshold: number; // Activation threshold
    state: this;
}

/**
 * Represents a synapse (connection between two neurons)
 */
export interface ISpikeSynapse extends ISynapse {
    delay: number; // Time delay for spike transmission
    plasticity?: Nullable<boolean>; // Whether STDP is applied
}

/**
 * Represents the entire Spiking Neural Network as a directed graph
 */
export interface ISnnGraph extends IGraph<ISpikeNeuron, ISpikeSynapse> {}

/**
 * Type guard for INeuron
 */
export function isNeuron(obj: unknown): obj is ISpikeNeuron {
    return isNode(obj) && "membranePotential" in obj && "threshold" in obj && "lastSpikeTime" in obj && "spikes" in obj && Array.isArray((obj as ISpikeNeuron).spikes);
}

/**
 * Type guard for ISynapse
 */
export function isSynapse(obj: unknown): obj is ISpikeSynapse {
    return isOlink(obj) && "weight" in obj && "delay" in obj && (obj as ISpikeSynapse).weight !== undefined && (obj as ISpikeSynapse).delay !== undefined;
}

/**
 * Type guard for ISnnGraph
 */
export function isSnnGraph(obj: unknown): obj is ISnnGraph {
    return (
        isGraph(obj) &&
        Array.isArray((obj as IGraph<ISpikeNeuron, ISpikeSynapse>).nodes) &&
        Array.isArray((obj as IGraph<ISpikeNeuron, ISpikeSynapse>).links) &&
        (obj as IGraph<ISpikeNeuron, ISpikeSynapse>).nodes.every(isNeuron) &&
        (obj as IGraph<ISpikeNeuron, ISpikeSynapse>).links.every(isSynapse)
    );
}
