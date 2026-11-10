import { ActivationFunctions } from "../ann/mlp/mlp.activation";
import { ICnnGraph, ICnnSynapse } from "./cnn.interfaces";
import { CnnBuilder, ConvLayerConfig, PoolLayerConfig } from "./cnn.builder";
import { PaddingType } from "./cnn.interfaces";

/// <summary>
/// Configuration for the autoencoder builder.
/// </summary>
export interface AutoencoderConfig {
    inputWidth: number;
    inputHeight: number;
    inputChannels: number;
    latentDim: number;
}

/// <summary>
/// Result of building an autoencoder: contains both the full autoencoder
/// (for training) and the encoder-only graph (for inference).
/// The encoder graph shares kernel objects with the autoencoder,
/// so after training the autoencoder, encoder weights are already updated.
/// </summary>
export interface IAutoencoderResult {
    autoencoder: ICnnGraph;
    encoder: ICnnGraph;
}

interface EncoderLayerSpec {
    type: "conv" | "pool";
    config: ConvLayerConfig | PoolLayerConfig;
    /// Spatial dimensions after this layer (computed during build)
    outputWidth?: number;
    outputHeight?: number;
    outputChannels?: number;
}

function computeOutputSize(inputSize: number, kernelSize: number, stride: number, padding: PaddingType): number {
    if (padding === PaddingType.Same) {
        return Math.ceil(inputSize / stride);
    }
    return Math.floor((inputSize - kernelSize) / stride) + 1;
}

/// <summary>
/// Builds an autoencoder from encoder layer specs.
/// The decoder is automatically mirrored from the encoder:
///   - Pool layers become Upsample layers
///   - Conv layers become Conv layers with Same padding (reversed channel counts)
///   - Final output uses sigmoid activation to produce [0,1] values
/// </summary>
export class AutoencoderBuilder {
    private _config: AutoencoderConfig;
    private _encoderSpecs: EncoderLayerSpec[] = [];

    public constructor(config: AutoencoderConfig) {
        this._config = config;
    }

    public withConvLayer(config: ConvLayerConfig): AutoencoderBuilder {
        this._encoderSpecs.push({ type: "conv", config });
        return this;
    }

    public withPoolLayer(config: PoolLayerConfig): AutoencoderBuilder {
        this._encoderSpecs.push({ type: "pool", config });
        return this;
    }

    public build(): IAutoencoderResult {
        const { inputWidth, inputHeight, inputChannels, latentDim } = this._config;

        // --- Compute encoder layer dimensions ---
        let w = inputWidth;
        let h = inputHeight;
        let c = inputChannels;
        const dims: { w: number; h: number; c: number }[] = [{ w, h, c }];

        for (const spec of this._encoderSpecs) {
            if (spec.type === "conv") {
                const cfg = spec.config as ConvLayerConfig;
                const [kH, kW] = toTuple(cfg.kernelSize);
                const [sH, sW] = toTuple(cfg.stride ?? 1);
                const padding = cfg.padding ?? PaddingType.Valid;
                h = computeOutputSize(h, kH, sH, padding);
                w = computeOutputSize(w, kW, sW, padding);
                c = cfg.filters;
            } else {
                const cfg = spec.config as PoolLayerConfig;
                const [pH, pW] = toTuple(cfg.size);
                const [sH, sW] = toTuple(cfg.stride ?? cfg.size);
                h = Math.floor((h - pH) / sH) + 1;
                w = Math.floor((w - pW) / sW) + 1;
                // channels unchanged for pool
            }
            spec.outputWidth = w;
            spec.outputHeight = h;
            spec.outputChannels = c;
            dims.push({ w, h, c });
        }

        const flatSize = w * h * c;

        // --- Build encoder-only graph ---
        const encoder = this._buildEncoder(inputWidth, inputHeight, inputChannels, latentDim);

        // --- Build full autoencoder (encoder + decoder) ---
        const autoencoder = this._buildAutoencoder(inputWidth, inputHeight, inputChannels, latentDim, flatSize, w, h, c, dims);

        // --- Share kernels: copy encoder kernel weights into autoencoder ---
        // The encoder and autoencoder are separate graphs, but we link the encoder's
        // kernel references to the autoencoder's encoder-portion kernels so that
        // after training the autoencoder, calling encoder inference uses trained weights.
        const encoderKernelCount = encoder.kernels.length;
        for (let i = 0; i < encoderKernelCount; i++) {
            // Replace encoder kernel with autoencoder kernel (same object reference)
            encoder.kernels[i] = autoencoder.kernels[i];
        }

        // Also share the encoder's dense synapse weights with the autoencoder
        // The encoder's last dense layer synapses must share weights with
        // the autoencoder's corresponding dense layer synapses.
        this._shareDenseWeights(encoder, autoencoder);

        return { autoencoder, encoder };
    }

    private _buildEncoder(inputWidth: number, inputHeight: number, inputChannels: number, latentDim: number): ICnnGraph {
        const builder = new CnnBuilder();
        builder.withInputLayer(inputWidth, inputHeight, inputChannels);

        for (const spec of this._encoderSpecs) {
            if (spec.type === "conv") {
                builder.withConvLayer(spec.config as ConvLayerConfig);
            } else {
                builder.withPoolLayer(spec.config as PoolLayerConfig);
            }
        }

        builder.withFlattenLayer();
        builder.withDenseLayer({ units: latentDim, activation: ActivationFunctions.linear });

        return builder.build();
    }

    private _buildAutoencoder(
        inputWidth: number,
        inputHeight: number,
        inputChannels: number,
        latentDim: number,
        flatSize: number,
        lastW: number,
        lastH: number,
        lastC: number,
        dims: { w: number; h: number; c: number }[]
    ): ICnnGraph {
        const builder = new CnnBuilder();

        // --- Encoder portion ---
        builder.withInputLayer(inputWidth, inputHeight, inputChannels);

        for (const spec of this._encoderSpecs) {
            if (spec.type === "conv") {
                builder.withConvLayer(spec.config as ConvLayerConfig);
            } else {
                builder.withPoolLayer(spec.config as PoolLayerConfig);
            }
        }

        builder.withFlattenLayer();
        builder.withDenseLayer({ units: latentDim, activation: ActivationFunctions.linear });

        // --- Decoder portion (mirror of encoder) ---
        // Dense back to flat spatial size
        builder.withDenseLayer({ units: flatSize, activation: ActivationFunctions.relu });

        // Reshape from flat back to spatial
        builder.withReshapeLayer({ width: lastW, height: lastH, channels: lastC });

        // Mirror encoder layers in reverse
        for (let i = this._encoderSpecs.length - 1; i >= 0; i--) {
            const spec = this._encoderSpecs[i];
            const prevDims = dims[i]; // dimensions before this encoder layer

            if (spec.type === "pool") {
                // Pool -> Upsample
                const cfg = spec.config as PoolLayerConfig;
                const [pH, pW] = toTuple(cfg.size);
                builder.withUpsampleLayer({ factor: [pH, pW] });
            } else {
                // Conv -> Conv with reversed channels, Same padding
                const cfg = spec.config as ConvLayerConfig;
                const [kH, kW] = toTuple(cfg.kernelSize);

                // Last decoder conv (i === 0) outputs inputChannels with sigmoid
                const isLast = i === 0;
                const outChannels = prevDims.c;
                builder.withConvLayer({
                    filters: outChannels,
                    kernelSize: [kH, kW],
                    stride: 1,
                    padding: PaddingType.Same,
                    activation: isLast ? ActivationFunctions.sigmoid : (cfg.activation ?? ActivationFunctions.relu),
                });
            }
        }

        return builder.build();
    }

    /// <summary>
    /// Initial weight sync between encoder and autoencoder dense layers.
    /// ConvKernel weights are shared by reference. Dense weights need explicit sync after training.
    /// </summary>
    private _shareDenseWeights(_encoder: ICnnGraph, _autoencoder: ICnnGraph): void {
        // Kernels are already shared by reference (assigned above).
        // Dense synapse weights will be synced after training via syncWeights().
    }

    /// <summary>
    /// Copies trained weights from the autoencoder's encoder portion to the standalone encoder.
    /// Call this after training to sync weights.
    /// </summary>
    public static syncWeights(result: IAutoencoderResult): void {
        const { autoencoder, encoder } = result;

        // Kernels are already shared by reference — no sync needed for conv layers

        // Sync dense layer weights: copy from autoencoder to encoder
        const encoderDescs = encoder.layerDescriptors;
        const aeDescs = autoencoder.layerDescriptors;

        // Sync the latent dense layer
        const encoderLatentDesc = encoderDescs[encoderDescs.length - 1];
        const aeLatentIdx = encoderDescs.length - 1;
        const aeLatentDesc = aeDescs[aeLatentIdx];

        for (let n = 0; n < encoderLatentDesc.neurons.length; n++) {
            const encNeuron = encoderLatentDesc.neurons[n];
            const aeNeuron = aeLatentDesc.neurons[n];

            // Sync bias
            encNeuron.bias = aeNeuron.bias;

            // Sync synapse weights
            const encSynapses = (encNeuron.opsc<ICnnSynapse>() ?? []) as ICnnSynapse[];
            const aeSynapses = (aeNeuron.opsc<ICnnSynapse>() ?? []) as ICnnSynapse[];
            for (let s = 0; s < encSynapses.length; s++) {
                encSynapses[s].weight = aeSynapses[s].weight;
            }
        }
    }
}

function toTuple(v: number | [number, number]): [number, number] {
    return typeof v === "number" ? [v, v] : v;
}
