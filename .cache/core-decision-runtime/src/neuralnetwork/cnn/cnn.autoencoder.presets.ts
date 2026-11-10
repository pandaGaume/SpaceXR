import { ActivationFunctions } from "../ann/mlp/mlp.activation";
import { PaddingType, PoolingType } from "./cnn.interfaces";
import { AutoencoderBuilder, AutoencoderConfig, IAutoencoderResult } from "./cnn.autoencoder.builder";

/// <summary>
/// Predefined autoencoder architectures for common grid sizes.
/// Each preset balances graph size vs. feature extraction quality.
/// </summary>
export enum AutoencoderPreset {
    /// <summary>
    /// For 16×16 inputs. Conv(8,3×3) → Pool(2×2) → Dense(latent).
    /// ~5K neurons total (encoder + decoder). Fast browser training.
    /// </summary>
    Tiny = "tiny",

    /// <summary>
    /// For 32×32 inputs. Conv(8,3×3) → Pool(2×2) → Conv(16,3×3) → Pool(2×2) → Dense(latent).
    /// ~20K neurons total. Moderate browser training.
    /// </summary>
    Small = "small",

    /// <summary>
    /// For 64×64 inputs. Conv(8,5×5) → Pool(2×2) → Conv(16,3×3) → Pool(2×2) → Conv(32,3×3) → Pool(2×2) → Dense(latent).
    /// ~40K+ neurons total. Not recommended for browser training.
    /// </summary>
    Standard = "standard",
}

export interface AutoencoderPresetConfig {
    width: number;
    height: number;
    channels: number;
    latentDim: number;
}

/// <summary>
/// Builds an autoencoder from a preset and input configuration.
/// Returns both the full autoencoder (for training) and the encoder-only graph (for inference).
/// </summary>
export function buildAutoencoderFromPreset(preset: AutoencoderPreset, config: AutoencoderPresetConfig): IAutoencoderResult {
    const { width, height, channels, latentDim } = config;
    const aeConfig: AutoencoderConfig = { inputWidth: width, inputHeight: height, inputChannels: channels, latentDim };

    switch (preset) {
        case AutoencoderPreset.Tiny:
            return new AutoencoderBuilder(aeConfig)
                .withConvLayer({ filters: 8, kernelSize: 3, padding: PaddingType.Same, activation: ActivationFunctions.relu })
                .withPoolLayer({ type: PoolingType.Max, size: 2 })
                .build();

        case AutoencoderPreset.Small:
            return new AutoencoderBuilder(aeConfig)
                .withConvLayer({ filters: 8, kernelSize: 3, padding: PaddingType.Same, activation: ActivationFunctions.relu })
                .withPoolLayer({ type: PoolingType.Max, size: 2 })
                .withConvLayer({ filters: 16, kernelSize: 3, padding: PaddingType.Same, activation: ActivationFunctions.relu })
                .withPoolLayer({ type: PoolingType.Max, size: 2 })
                .build();

        case AutoencoderPreset.Standard:
            return new AutoencoderBuilder(aeConfig)
                .withConvLayer({ filters: 8, kernelSize: 5, padding: PaddingType.Same, activation: ActivationFunctions.relu })
                .withPoolLayer({ type: PoolingType.Max, size: 2 })
                .withConvLayer({ filters: 16, kernelSize: 3, padding: PaddingType.Same, activation: ActivationFunctions.relu })
                .withPoolLayer({ type: PoolingType.Max, size: 2 })
                .withConvLayer({ filters: 32, kernelSize: 3, padding: PaddingType.Same, activation: ActivationFunctions.relu })
                .withPoolLayer({ type: PoolingType.Max, size: 2 })
                .build();
    }
}
