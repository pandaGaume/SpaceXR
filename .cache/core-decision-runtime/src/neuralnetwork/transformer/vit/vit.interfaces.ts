import { IGraph } from "../../../graph";
import { INeuron, ISynapse } from "../../nn.interfaces";
import type { IActivationFunction } from "../../ann/mlp/mlp.interfaces";

// ---------------------------------------------------------------------------
// Neuron types
// ---------------------------------------------------------------------------

/// <summary>
/// Types of neurons in a Vision Transformer graph.
/// </summary>
export enum VitNeuronType {
    /// <summary>Raw pixel input</summary>
    Input = "input",
    /// <summary>Linear projection of a flattened patch into embedding space</summary>
    PatchEmbed = "patch_embed",
    /// <summary>Learnable class token that aggregates information from all patches</summary>
    ClassToken = "class_token",
    /// <summary>Attention neuron - computes Q/K/V and attention-weighted output</summary>
    Attention = "attention",
    /// <summary>Feed-forward MLP neuron within a transformer block</summary>
    MLP = "mlp",
    /// <summary>Classification head output neuron</summary>
    Output = "output",
}

/// <summary>
/// Base interface for all ViT neurons.
/// </summary>
export interface IVitNeuron extends INeuron {
    neuronType: VitNeuronType;
    bias: number;
    /// <summary>Position within the embedding dimension</summary>
    embedIndex: number;
    /// <summary>Which token (patch) this neuron belongs to (-1 for class token)</summary>
    tokenIndex: number;
    /// <summary>Which transformer block this neuron belongs to (-1 for embed/output)</summary>
    blockIndex: number;
    /// <summary>Which attention head (-1 if not attention)</summary>
    headIndex: number;
}

// ---------------------------------------------------------------------------
// Synapse types
// ---------------------------------------------------------------------------

/// <summary>
/// Types of synapses in a ViT graph.
/// </summary>
export enum VitSynapseType {
    /// <summary>Patch pixel to embedding projection</summary>
    Embed = "embed",
    /// <summary>Q/K/V projection synapse carrying 3 weights</summary>
    QKV = "qkv",
    /// <summary>Attention output projection</summary>
    Projection = "projection",
    /// <summary>MLP feed-forward connection</summary>
    MLP = "mlp",
    /// <summary>Residual skip connection (weight = 1, not trainable)</summary>
    Residual = "residual",
    /// <summary>Classification head connection</summary>
    Head = "head",
}

/// <summary>
/// ViT synapse. For QKV synapses, stores 3 weights [wQ, wK, wV].
/// For all other types, uses a single weight.
/// </summary>
export interface IVitSynapse extends ISynapse {
    synapseType: VitSynapseType;
    /// <summary>
    /// For QKV synapses: [wQ, wK, wV]
    /// For other types: [weight] (single element)
    /// </summary>
    weights: number[];
}

// ---------------------------------------------------------------------------
// LayerNorm parameters
// ---------------------------------------------------------------------------

/// <summary>
/// Layer normalization parameters for a group of neurons.
/// </summary>
export interface ILayerNorm {
    /// <summary>Scale parameters (gamma), one per feature</summary>
    gamma: number[];
    /// <summary>Shift parameters (beta), one per feature</summary>
    beta: number[];
    /// <summary>Small epsilon for numerical stability</summary>
    epsilon: number;
}

// ---------------------------------------------------------------------------
// Graph
// ---------------------------------------------------------------------------

/// <summary>
/// ViT graph with additional metadata for transformer structure.
/// </summary>
/// <summary>
/// Transformer block weight matrices.
/// Stored as flat arrays for efficient computation.
/// </summary>
export interface ITransformerBlockWeights {
    /// <summary>QKV projection: [numHeads][3][embedDim][headDim] flattened to [3 * embedDim * embedDim]</summary>
    qkvWeights: number[];
    /// <summary>QKV biases: [3 * embedDim]</summary>
    qkvBias: number[];
    /// <summary>Output projection: [embedDim * embedDim]</summary>
    projWeights: number[];
    /// <summary>Output projection bias: [embedDim]</summary>
    projBias: number[];
    /// <summary>MLP first layer: [embedDim * mlpDim]</summary>
    mlp1Weights: number[];
    /// <summary>MLP first layer bias: [mlpDim]</summary>
    mlp1Bias: number[];
    /// <summary>MLP second layer: [mlpDim * embedDim]</summary>
    mlp2Weights: number[];
    /// <summary>MLP second layer bias: [embedDim]</summary>
    mlp2Bias: number[];
}

export interface IVitGraph extends IGraph<IVitNeuron, IVitSynapse> {
    /// <summary>Number of patches (tokens)</summary>
    numPatches: number;
    /// <summary>Embedding dimension</summary>
    embedDim: number;
    /// <summary>Number of attention heads</summary>
    numHeads: number;
    /// <summary>Number of transformer blocks</summary>
    numBlocks: number;
    /// <summary>Patch size in pixels</summary>
    patchSize: number;
    /// <summary>Number of output classes</summary>
    numClasses: number;
    /// <summary>MLP expansion ratio</summary>
    mlpRatio: number;
    /// <summary>LayerNorm parameters per block (2 per block: pre-attention, pre-MLP)</summary>
    layerNorms: ILayerNorm[];
    /// <summary>Positional embeddings (numPatches+1 x embedDim)</summary>
    positionalEmbeddings: number[][];
    /// <summary>Transformer block weight matrices</summary>
    blockWeights: ITransformerBlockWeights[];
    /// <summary>Patch embedding weights: [patchPixels * embedDim]</summary>
    patchEmbedWeights: number[];
    /// <summary>Patch embedding bias: [embedDim]</summary>
    patchEmbedBias: number[];
    /// <summary>Class token values: [embedDim]</summary>
    classTokenValues: number[];
    /// <summary>Classification head weights: [embedDim * numClasses]</summary>
    headWeights: number[];
    /// <summary>Classification head bias: [numClasses]</summary>
    headBias: number[];
    /// <summary>Per-patch decoder weights: [embedDim * patchPixels] (MAE mode)</summary>
    patchDecoderWeights?: number[];
    /// <summary>Per-patch decoder bias: [patchPixels] (MAE mode)</summary>
    patchDecoderBias?: number[];
}

// ---------------------------------------------------------------------------
// Inference contexts (stored in neuron.bag)
// ---------------------------------------------------------------------------

/// <summary>
/// Context for ViT neurons during inference.
/// </summary>
export interface IVitInferenceContext {
    /// <summary>Weighted sum before activation</summary>
    sum: number;
    /// <summary>Post-activation value</summary>
    activation: number;
}

/// <summary>
/// Context for attention neurons, storing Q/K/V values and attention scores.
/// </summary>
export interface IVitAttentionContext extends IVitInferenceContext {
    /// <summary>Query value for this neuron</summary>
    q: number;
    /// <summary>Key value for this neuron</summary>
    k: number;
    /// <summary>Value value for this neuron</summary>
    v: number;
    /// <summary>Attention scores (softmax output) - one per token</summary>
    attentionScores?: number[];
    /// <summary>Pre-attention activation (for residual)</summary>
    preAttentionActivation?: number;
    /// <summary>Pre-MLP activation (for residual)</summary>
    preMLPActivation?: number;
}

// ---------------------------------------------------------------------------
// Training contexts
// ---------------------------------------------------------------------------

/// <summary>
/// Backprop context for ViT neurons.
/// </summary>
export interface IVitBackpropNeuronContext extends IVitInferenceContext {
    gradient: number;
    /// <summary>Gradients for Q/K/V (attention neurons only)</summary>
    dQ?: number;
    dK?: number;
    dV?: number;
}

/// <summary>
/// Backprop context for ViT synapses.
/// </summary>
export interface IVitBackpropSynapseContext {
    /// <summary>Gradient per weight (matches weights array length)</summary>
    gradients: number[];
    /// <summary>Adam first moment estimates</summary>
    m?: number[];
    /// <summary>Adam second moment estimates</summary>
    v?: number[];
}

// ---------------------------------------------------------------------------
// Builder config
// ---------------------------------------------------------------------------

/// <summary>
/// Configuration for building a ViT network.
/// </summary>
export interface IVitConfig {
    /// <summary>Input image width</summary>
    width: number;
    /// <summary>Input image height</summary>
    height: number;
    /// <summary>Input channels (1 for grayscale, 3 for RGB)</summary>
    channels: number;
    /// <summary>Patch size in pixels (patches are square)</summary>
    patchSize: number;
    /// <summary>Embedding dimension</summary>
    embedDim: number;
    /// <summary>Number of attention heads</summary>
    numHeads: number;
    /// <summary>Number of transformer blocks</summary>
    numBlocks: number;
    /// <summary>MLP expansion ratio (mlpDim = embedDim * mlpRatio)</summary>
    mlpRatio: number;
    /// <summary>Number of output classes</summary>
    numClasses: number;
    /// <summary>Activation function for MLP blocks (default: ReLU)</summary>
    mlpActivation?: IActivationFunction;
}

// ---------------------------------------------------------------------------
// Presets
// ---------------------------------------------------------------------------

/// <summary>
/// Pre-configured ViT architectures for MNIST (28x28x1).
/// </summary>
export const VitPresets = {
    /// <summary>Minimal ViT for quick testing</summary>
    tiny: {
        width: 28,
        height: 28,
        channels: 1,
        patchSize: 7,
        embedDim: 64,
        numHeads: 4,
        numBlocks: 2,
        mlpRatio: 2,
        numClasses: 10,
    } as IVitConfig,

    /// <summary>Moderate ViT for better accuracy</summary>
    small: {
        width: 28,
        height: 28,
        channels: 1,
        patchSize: 7,
        embedDim: 128,
        numHeads: 4,
        numBlocks: 4,
        mlpRatio: 2,
        numClasses: 10,
    } as IVitConfig,
};
