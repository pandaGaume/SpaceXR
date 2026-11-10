import { ISynapse } from "./nn.interfaces";

/// <summary>
/// Represents the runtime training context for a synapse during backpropagation.
/// </summary>
export interface IBackpropSynapseContext {
    /// <summary>Gradient of the loss with respect to the synaptic weight</summary>
    gradient?: number;

    /// <summary>Velocity term used in momentum-based optimizers (e.g., SGD with momentum, NAG)</summary>
    velocity?: number;

    /// <summary>First moment estimate (mean of gradients), used by the Adam optimizer</summary>
    m?: number;

    /// <summary>Second moment estimate (uncentered variance of gradients), used by the Adam optimizer</summary>
    v?: number;

    /// <summary>Anticipated weight used during the forward pass (for NAG optimizers)</summary>
    prelookedWeight?: number;

    /// <summary>Suggested weight update (usually learningRate × gradient), may be applied after batch or optimization step</summary>
    weightDelta?: number;
}

/// <summary>
/// Defines a loss function and its derivative for training.
/// </summary>
export interface ILossFunction {
    loss(output: number, expected: number): number;
    dLoss(output: number, expected: number): number;
}

/// <summary>
/// A loss function that applies per-channel weights.
/// Useful for multi-channel autoencoders where some channels (e.g., velocity, z_max)
/// carry sparse but critical information that would be ignored by uniform MSE.
///
/// Usage:
///   const weightedMSE = new WeightedChannelLoss(LossFunctions.MSE, [1, 3, 1, 1, 1, 5], 16, 16);
///   // channels: [density, z_max, z_min, std_z, reflectivity, velocity]
///   // z_max weighted 3x, velocity weighted 5x
/// </summary>
export class WeightedChannelLoss implements ILossFunction {
    private _channelSize: number;

    /// <summary>
    /// Creates a weighted channel loss function.
    /// </summary>
    /// <param name="baseLoss">The underlying loss function (e.g., LossFunctions.MSE)</param>
    /// <param name="channelWeights">Array of weights, one per channel. Default weight is 1.0.</param>
    /// <param name="width">Grid width (pixels per row)</param>
    /// <param name="height">Grid height (pixels per column)</param>
    public constructor(
        public readonly baseLoss: ILossFunction,
        public readonly channelWeights: number[],
        width: number,
        height: number
    ) {
        this._channelSize = width * height;
    }

    /// <summary>
    /// Returns the channel index for a given output neuron index (CHW layout).
    /// </summary>
    private _channelOf(index: number): number {
        return Math.floor(index / this._channelSize);
    }

    /// <summary>
    /// Weighted loss for a single output neuron.
    /// The index parameter must be set via setCurrentIndex() before calling.
    /// Since ILossFunction doesn't carry index, we use a stateful approach.
    /// </summary>
    private _currentIndex: number = 0;

    public setCurrentIndex(index: number): void {
        this._currentIndex = index;
    }

    public loss(output: number, expected: number): number {
        const ch = this._channelOf(this._currentIndex);
        const w = ch < this.channelWeights.length ? this.channelWeights[ch] : 1.0;
        return w * this.baseLoss.loss(output, expected);
    }

    public dLoss(output: number, expected: number): number {
        const ch = this._channelOf(this._currentIndex);
        const w = ch < this.channelWeights.length ? this.channelWeights[ch] : 1.0;
        return w * this.baseLoss.dLoss(output, expected);
    }
}

/// <summary>
/// Defines a strategy for applying weight updates during training.
/// The target must have a `weight` property and a `bag` for optimizer state.
/// </summary>
export interface IOptimizer {
    /// <summary>Applies the weight update based on gradient and internal context</summary>
    apply(target: ISynapse, learningRate: number, gradient: number, context: ITrainingContext): void;
}

/// <summary>
/// Tracks training progress across iterations, epochs, and batches.
/// </summary>
export interface ITrainingContext {
    iteration: number;
    epoch?: number;
    batchIndex?: number;
    batchSize?: number;
    loss?: number;
}
