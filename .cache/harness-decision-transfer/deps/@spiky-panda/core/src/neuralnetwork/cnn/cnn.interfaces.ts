import { IGraph } from "../../graph";
import { INeuron, ISynapse } from "../nn.interfaces";
import { IActivationFunction } from "../ann/mlp/mlp.interfaces";
import type { ICnnBackpropNeuronContext } from "./training/cnn.training.interfaces";
import type { IBackpropSynapseContext } from "../nn.training";
export type { IActivationFunction } from "../ann/mlp/mlp.interfaces";

/// <summary>
/// Discriminates the type of layer a CNN neuron belongs to.
/// Determines forward-pass behavior.
/// </summary>
export enum CnnLayerType {
    Input = "input",
    Conv = "conv",
    Pool = "pool",
    Flatten = "flatten",
    Dense = "dense",
    Upsample = "upsample",
    Reshape = "reshape",
}

/// <summary>
/// Type of pooling operation.
/// </summary>
export enum PoolingType {
    Max = "max",
    Avg = "avg",
}

/// <summary>
/// Padding strategy for convolutional layers.
/// </summary>
export enum PaddingType {
    /// <summary>No padding — output shrinks</summary>
    Valid = "valid",
    /// <summary>Zero-padding to keep output same size as input</summary>
    Same = "same",
}

/// <summary>
/// A convolutional kernel (filter) that holds shared weights.
/// Multiple synapses across spatial positions reference the same kernel.
/// </summary>
export interface IConvKernel {
    readonly height: number;
    readonly width: number;
    readonly inputChannels: number;
    readonly weights: number[];
    bias: number;
}

/// <summary>
/// Inference context stored in a CNN neuron's bag during forward pass.
/// </summary>
export interface ICnnInferenceContext {
    sum: number;
    activation: number;
    remainingInputs: number;
    totalInputs: number;
}

/// <summary>
/// A neuron in a CNN graph. Carries spatial metadata and layer type.
/// </summary>
export interface ICnnNeuron extends INeuron<ICnnBackpropNeuronContext> {
    layerType: CnnLayerType;
    bias: number;
    activationFn?: IActivationFunction;
    poolType?: PoolingType;
    row: number;
    col: number;
    channel: number;
}

export function isCnnNeuron(obj: unknown): obj is ICnnNeuron {
    return typeof obj === "object" && obj !== null && "layerType" in obj && "row" in obj && "col" in obj && "channel" in obj;
}

/// <summary>
/// A synapse in a CNN graph. For conv layers, delegates weight to a shared kernel.
/// For pool/flatten/dense layers, kernel may be null and weight is stored directly.
/// </summary>
export interface ICnnSynapse extends ISynapse<IBackpropSynapseContext> {
    kernel: IConvKernel | null;
    kernelIndex: number;
}

/// <summary>
/// Metadata describing one layer's shape in the CNN.
/// The optional fields are populated by the builder for the layer
/// types that need them (Conv, Pool). They are used by downstream
/// consumers such as the ONNX exporter that need to know stride /
/// kernel-size / pool-type without walking individual synapses.
/// </summary>
export interface ICnnLayerDescriptor {
    type: CnnLayerType;
    width: number;
    height: number;
    channels: number;
    neurons: ICnnNeuron[];

    /** Conv / Pool: [kH, kW]. */
    kernelSize?: [number, number];
    /** Conv / Pool: [sH, sW]. */
    stride?: [number, number];
    /** Conv: symmetric padding [padH, padW] applied before and after. */
    padding?: [number, number];
    /** Pool: Max or Avg. */
    poolType?: PoolingType;
    /** Conv: one IConvKernel per output filter (shared weights). */
    convKernels?: IConvKernel[];
}

/// <summary>
/// A complete CNN graph composed of neurons, synapses, and kernels.
/// </summary>
export interface ICnnGraph extends IGraph<ICnnNeuron, ICnnSynapse> {
    kernels: IConvKernel[];
    layerDescriptors: ICnnLayerDescriptor[];
}
