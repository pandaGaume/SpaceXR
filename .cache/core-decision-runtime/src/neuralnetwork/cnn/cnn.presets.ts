import { ActivationFunctions } from "../ann/mlp/mlp.activation";
import { PoolingType } from "./cnn.interfaces";
import { CnnBuilder } from "./cnn.builder";
import { ICnnGraph } from "./cnn.interfaces";

/// <summary>
/// Predefined CNN architecture presets for common image classification tasks.
/// Each preset takes input dimensions and number of classes, and returns a ready-to-use graph.
/// </summary>

export enum CnnPreset {
    /// <summary>
    /// Minimal architecture: Conv(4, 3×3) → Pool(2×2) → Flatten → Dense(classes).
    /// ~4K nodes for 28×28×1. Fast training, lower accuracy.
    /// </summary>
    Fast = "fast",

    /// <summary>
    /// Balanced architecture: Conv(8, 5×5) → Pool(2×2) → Flatten → Dense(classes).
    /// ~6K nodes for 28×28×1. Good tradeoff between speed and accuracy.
    /// </summary>
    Balanced = "balanced",

    /// <summary>
    /// LeNet-inspired: Conv(16, 5×5) → Pool(2×2) → Conv(32, 5×5) → Pool(2×2) → Flatten → Dense(classes).
    /// ~20K+ nodes for 28×28×1. Best accuracy, slowest in graph model.
    /// </summary>
    Accuracy = "accuracy",
}

export interface CnnPresetConfig {
    width: number;
    height: number;
    channels: number;
    numClasses: number;
}

/// <summary>
/// Builds a CNN graph from a preset and input configuration.
/// </summary>
export function buildCnnFromPreset(preset: CnnPreset, config: CnnPresetConfig): ICnnGraph {
    const { width, height, channels, numClasses } = config;

    switch (preset) {
        case CnnPreset.Fast:
            return new CnnBuilder()
                .withInputLayer(width, height, channels)
                .withConvLayer({ filters: 4, kernelSize: 3, activation: ActivationFunctions.relu })
                .withPoolLayer({ type: PoolingType.Max, size: 2 })
                .withFlattenLayer()
                .withDenseLayer({ units: numClasses, activation: ActivationFunctions.sigmoid })
                .build();

        case CnnPreset.Balanced:
            return new CnnBuilder()
                .withInputLayer(width, height, channels)
                .withConvLayer({ filters: 8, kernelSize: 5, activation: ActivationFunctions.relu })
                .withPoolLayer({ type: PoolingType.Max, size: 2 })
                .withFlattenLayer()
                .withDenseLayer({ units: numClasses, activation: ActivationFunctions.sigmoid })
                .build();

        case CnnPreset.Accuracy:
            return new CnnBuilder()
                .withInputLayer(width, height, channels)
                .withConvLayer({ filters: 16, kernelSize: 5, activation: ActivationFunctions.relu })
                .withPoolLayer({ type: PoolingType.Max, size: 2 })
                .withConvLayer({ filters: 32, kernelSize: 5, activation: ActivationFunctions.relu })
                .withPoolLayer({ type: PoolingType.Max, size: 2 })
                .withFlattenLayer()
                .withDenseLayer({ units: numClasses, activation: ActivationFunctions.sigmoid })
                .build();
    }
}
