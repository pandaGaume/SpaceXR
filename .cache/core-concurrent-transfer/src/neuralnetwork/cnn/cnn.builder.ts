import { Cartesian3 } from "../../geometry";
import { ActivationFunctions } from "../ann/mlp/mlp.activation";
import { IWeightInitializer, He, Uniform } from "../nn.weights";
import { CnnLayerType, IActivationFunction, ICnnGraph, ICnnLayerDescriptor, ICnnNeuron, ICnnSynapse, IConvKernel, PaddingType, PoolingType } from "./cnn.interfaces";
import { CnnGraph } from "./cnn.graph";
import { CnnNeuron } from "./cnn.neuron";
import { CnnSynapse } from "./cnn.synapse";
import { ConvKernel } from "./cnn.kernel";

export interface ConvLayerConfig {
    filters: number;
    kernelSize: number | [number, number];
    stride?: number | [number, number];
    padding?: PaddingType;
    activation?: IActivationFunction;
    weightInitializer?: IWeightInitializer;
    biasInit?: number;
}

export interface PoolLayerConfig {
    type: PoolingType;
    size: number | [number, number];
    stride?: number | [number, number];
}

export interface DenseLayerConfig {
    units: number;
    activation?: IActivationFunction;
    weightInitializer?: IWeightInitializer;
    biasInit?: number;
}

export interface UpsampleLayerConfig {
    factor: number | [number, number];
}

export interface ReshapeLayerConfig {
    width: number;
    height: number;
    channels: number;
}

interface LayerSpec {
    type: CnnLayerType;
    config: ConvLayerConfig | PoolLayerConfig | DenseLayerConfig | UpsampleLayerConfig | ReshapeLayerConfig | null;
}

function toTuple(v: number | [number, number]): [number, number] {
    return typeof v === "number" ? [v, v] : v;
}

function computeOutputSize(inputSize: number, kernelSize: number, stride: number, padding: PaddingType): number {
    if (padding === PaddingType.Same) {
        return Math.ceil(inputSize / stride);
    }
    return Math.floor((inputSize - kernelSize) / stride) + 1;
}

function computePadding(inputSize: number, kernelSize: number, stride: number, padding: PaddingType): number {
    if (padding === PaddingType.Same) {
        const outSize = Math.ceil(inputSize / stride);
        const totalPad = Math.max((outSize - 1) * stride + kernelSize - inputSize, 0);
        return Math.floor(totalPad / 2);
    }
    return 0;
}

/// <summary>
/// Declarative builder for CNN graphs.
/// Constructs the full graph of neurons and synapses, including kernels with shared weights.
///
/// All concrete object instantiation goes through the protected factory
/// methods at the bottom of the class (_createNeuron, _createSynapse,
/// _createKernel, _createGraph). Subclass builders override those
/// factories to swap in custom neuron / synapse / kernel / graph types
/// without rewriting the layer-assembly logic.
/// </summary>
export class CnnBuilder {
    protected _inputWidth: number = 0;
    protected _inputHeight: number = 0;
    protected _inputChannels: number = 0;
    protected _layers: LayerSpec[] = [];

    public withInputLayer(width: number, height: number, channels: number): CnnBuilder {
        this._inputWidth = width;
        this._inputHeight = height;
        this._inputChannels = channels;
        this._layers.push({ type: CnnLayerType.Input, config: null });
        return this;
    }

    public withConvLayer(config: ConvLayerConfig): CnnBuilder {
        this._layers.push({ type: CnnLayerType.Conv, config });
        return this;
    }

    public withPoolLayer(config: PoolLayerConfig): CnnBuilder {
        this._layers.push({ type: CnnLayerType.Pool, config });
        return this;
    }

    public withFlattenLayer(): CnnBuilder {
        this._layers.push({ type: CnnLayerType.Flatten, config: null });
        return this;
    }

    public withDenseLayer(config: DenseLayerConfig): CnnBuilder {
        this._layers.push({ type: CnnLayerType.Dense, config });
        return this;
    }

    public withUpsampleLayer(config: UpsampleLayerConfig): CnnBuilder {
        this._layers.push({ type: CnnLayerType.Upsample, config });
        return this;
    }

    public withReshapeLayer(config: ReshapeLayerConfig): CnnBuilder {
        this._layers.push({ type: CnnLayerType.Reshape, config });
        return this;
    }

    public build(): ICnnGraph {
        if (this._layers.length === 0 || this._layers[0].type !== CnnLayerType.Input) {
            throw new Error("First layer must be an input layer.");
        }

        const allNeurons: ICnnNeuron[] = [];
        const allSynapses: ICnnSynapse[] = [];
        const allKernels: IConvKernel[] = [];
        const layerDescriptors: ICnnLayerDescriptor[] = [];

        let prevDescriptor: ICnnLayerDescriptor | null = null;
        let layerDepth = 0;

        for (const spec of this._layers) {
            switch (spec.type) {
                case CnnLayerType.Input:
                    prevDescriptor = this._buildInputLayer(allNeurons, layerDescriptors, layerDepth);
                    break;
                case CnnLayerType.Conv:
                    prevDescriptor = this._buildConvLayer(spec.config as ConvLayerConfig, prevDescriptor!, allNeurons, allSynapses, allKernels, layerDescriptors, layerDepth);
                    break;
                case CnnLayerType.Pool:
                    prevDescriptor = this._buildPoolLayer(spec.config as PoolLayerConfig, prevDescriptor!, allNeurons, allSynapses, layerDescriptors, layerDepth);
                    break;
                case CnnLayerType.Flatten:
                    prevDescriptor = this._buildFlattenLayer(prevDescriptor!, allNeurons, allSynapses, layerDescriptors, layerDepth);
                    break;
                case CnnLayerType.Dense:
                    prevDescriptor = this._buildDenseLayer(spec.config as DenseLayerConfig, prevDescriptor!, allNeurons, allSynapses, layerDescriptors, layerDepth);
                    break;
                case CnnLayerType.Upsample:
                    prevDescriptor = this._buildUpsampleLayer(spec.config as UpsampleLayerConfig, prevDescriptor!, allNeurons, allSynapses, layerDescriptors, layerDepth);
                    break;
                case CnnLayerType.Reshape:
                    prevDescriptor = this._buildReshapeLayer(spec.config as ReshapeLayerConfig, prevDescriptor!, allNeurons, allSynapses, layerDescriptors, layerDepth);
                    break;
            }
            layerDepth++;
        }

        const inputDesc = layerDescriptors[0];
        const outputDesc = layerDescriptors[layerDescriptors.length - 1];
        const inputNeurons = inputDesc.neurons;
        const outputNeurons = outputDesc.neurons;
        const hiddenNeurons = allNeurons.filter((n) => !inputNeurons.includes(n) && !outputNeurons.includes(n));

        return this._createGraph(allNeurons, allSynapses, inputNeurons, outputNeurons, hiddenNeurons, allKernels, layerDescriptors);
    }

    private _buildInputLayer(allNeurons: ICnnNeuron[], layerDescriptors: ICnnLayerDescriptor[], layerDepth: number): ICnnLayerDescriptor {
        const neurons: ICnnNeuron[] = [];
        for (let c = 0; c < this._inputChannels; c++) {
            for (let r = 0; r < this._inputHeight; r++) {
                for (let col = 0; col < this._inputWidth; col++) {
                    const neuron = this._createNeuron(CnnLayerType.Input, r, col, c, 0, undefined, undefined, new Cartesian3(col, r, layerDepth));
                    neurons.push(neuron);
                    allNeurons.push(neuron);
                }
            }
        }

        const desc: ICnnLayerDescriptor = {
            type: CnnLayerType.Input,
            width: this._inputWidth,
            height: this._inputHeight,
            channels: this._inputChannels,
            neurons,
        };
        layerDescriptors.push(desc);
        return desc;
    }

    private _buildConvLayer(
        config: ConvLayerConfig,
        prev: ICnnLayerDescriptor,
        allNeurons: ICnnNeuron[],
        allSynapses: ICnnSynapse[],
        allKernels: IConvKernel[],
        layerDescriptors: ICnnLayerDescriptor[],
        layerDepth: number
    ): ICnnLayerDescriptor {
        const [kH, kW] = toTuple(config.kernelSize);
        const [sH, sW] = toTuple(config.stride ?? 1);
        const padding = config.padding ?? PaddingType.Valid;
        const activation = config.activation ?? ActivationFunctions.relu;
        const biasInit = config.biasInit ?? 0;

        const outH = computeOutputSize(prev.height, kH, sH, padding);
        const outW = computeOutputSize(prev.width, kW, sW, padding);
        const padH = computePadding(prev.height, kH, sH, padding);
        const padW = computePadding(prev.width, kW, sW, padding);

        const neurons: ICnnNeuron[] = [];

        // Create one kernel per output filter — each kernel has shape (kH × kW × inputChannels)
        const kernels: IConvKernel[] = [];
        for (let f = 0; f < config.filters; f++) {
            const fanIn = kH * kW * prev.channels;
            const initializer = config.weightInitializer ?? new He(fanIn);
            const kernel = this._createKernel(kH, kW, prev.channels, initializer, biasInit);
            kernels.push(kernel);
            allKernels.push(kernel);
        }

        // Create neurons and synapses
        for (let f = 0; f < config.filters; f++) {
            const kernel = kernels[f];
            for (let r = 0; r < outH; r++) {
                for (let col = 0; col < outW; col++) {
                    const neuron = this._createNeuron(CnnLayerType.Conv, r, col, f, kernel.bias, activation, undefined, new Cartesian3(col, r, layerDepth));
                    neurons.push(neuron);
                    allNeurons.push(neuron);

                    // Connect to receptive field in previous layer
                    for (let ic = 0; ic < prev.channels; ic++) {
                        for (let kr = 0; kr < kH; kr++) {
                            for (let kc = 0; kc < kW; kc++) {
                                const srcRow = r * sH + kr - padH;
                                const srcCol = col * sW + kc - padW;

                                // Skip out-of-bounds positions (padding with zeros — no synapse needed)
                                if (srcRow < 0 || srcRow >= prev.height || srcCol < 0 || srcCol >= prev.width) {
                                    continue;
                                }

                                const srcNeuron = this._getNeuronAt(prev, srcRow, srcCol, ic);
                                const kernelIndex = ic * kH * kW + kr * kW + kc;
                                const synapse = this._createSynapse(srcNeuron, neuron, kernel, kernelIndex);
                                allSynapses.push(synapse);
                            }
                        }
                    }
                }
            }
        }

        const desc: ICnnLayerDescriptor = {
            type: CnnLayerType.Conv,
            width: outW,
            height: outH,
            channels: config.filters,
            neurons,
            kernelSize: [kH, kW],
            stride: [sH, sW],
            padding: [padH, padW],
            convKernels: kernels.slice(),
        };
        layerDescriptors.push(desc);
        return desc;
    }

    private _buildPoolLayer(
        config: PoolLayerConfig,
        prev: ICnnLayerDescriptor,
        allNeurons: ICnnNeuron[],
        allSynapses: ICnnSynapse[],
        layerDescriptors: ICnnLayerDescriptor[],
        layerDepth: number
    ): ICnnLayerDescriptor {
        const [pH, pW] = toTuple(config.size);
        const [sH, sW] = toTuple(config.stride ?? config.size);

        const outH = Math.floor((prev.height - pH) / sH) + 1;
        const outW = Math.floor((prev.width - pW) / sW) + 1;

        const neurons: ICnnNeuron[] = [];

        for (let c = 0; c < prev.channels; c++) {
            for (let r = 0; r < outH; r++) {
                for (let col = 0; col < outW; col++) {
                    const neuron = this._createNeuron(CnnLayerType.Pool, r, col, c, 0, undefined, config.type, new Cartesian3(col, r, layerDepth));
                    neurons.push(neuron);
                    allNeurons.push(neuron);

                    // Connect to pool region in same channel of previous layer
                    for (let pr = 0; pr < pH; pr++) {
                        for (let pc = 0; pc < pW; pc++) {
                            const srcRow = r * sH + pr;
                            const srcCol = col * sW + pc;
                            if (srcRow < prev.height && srcCol < prev.width) {
                                const srcNeuron = this._getNeuronAt(prev, srcRow, srcCol, c);
                                const synapse = this._createSynapse(srcNeuron, neuron, null, -1, 1);
                                allSynapses.push(synapse);
                            }
                        }
                    }
                }
            }
        }

        const desc: ICnnLayerDescriptor = {
            type: CnnLayerType.Pool,
            width: outW,
            height: outH,
            channels: prev.channels,
            neurons,
            kernelSize: [pH, pW],
            stride: [sH, sW],
            poolType: config.type,
        };
        layerDescriptors.push(desc);
        return desc;
    }

    private _buildFlattenLayer(
        prev: ICnnLayerDescriptor,
        allNeurons: ICnnNeuron[],
        allSynapses: ICnnSynapse[],
        layerDescriptors: ICnnLayerDescriptor[],
        layerDepth: number
    ): ICnnLayerDescriptor {
        const totalUnits = prev.width * prev.height * prev.channels;
        const neurons: ICnnNeuron[] = [];

        let idx = 0;
        for (let c = 0; c < prev.channels; c++) {
            for (let r = 0; r < prev.height; r++) {
                for (let col = 0; col < prev.width; col++) {
                    const neuron = this._createNeuron(CnnLayerType.Flatten, 0, idx, 0, 0, undefined, undefined, new Cartesian3(idx, 0, layerDepth));
                    neurons.push(neuron);
                    allNeurons.push(neuron);

                    const srcNeuron = this._getNeuronAt(prev, r, col, c);
                    const synapse = this._createSynapse(srcNeuron, neuron, null, -1, 1);
                    allSynapses.push(synapse);
                    idx++;
                }
            }
        }

        const desc: ICnnLayerDescriptor = {
            type: CnnLayerType.Flatten,
            width: totalUnits,
            height: 1,
            channels: 1,
            neurons,
        };
        layerDescriptors.push(desc);
        return desc;
    }

    private _buildDenseLayer(
        config: DenseLayerConfig,
        prev: ICnnLayerDescriptor,
        allNeurons: ICnnNeuron[],
        allSynapses: ICnnSynapse[],
        layerDescriptors: ICnnLayerDescriptor[],
        layerDepth: number
    ): ICnnLayerDescriptor {
        const activation = config.activation ?? ActivationFunctions.relu;
        const biasInit = config.biasInit ?? 0;
        const initializer = config.weightInitializer ?? new Uniform(-1, 1);

        const neurons: ICnnNeuron[] = [];

        for (let i = 0; i < config.units; i++) {
            const neuron = this._createNeuron(CnnLayerType.Dense, 0, i, 0, biasInit, activation, undefined, new Cartesian3(i, 0, layerDepth));
            neurons.push(neuron);
            allNeurons.push(neuron);

            // Fully connected to all neurons in previous layer
            for (const srcNeuron of prev.neurons) {
                const synapse = this._createSynapse(srcNeuron, neuron, null, -1, initializer.next());
                allSynapses.push(synapse);
            }
        }

        const desc: ICnnLayerDescriptor = {
            type: CnnLayerType.Dense,
            width: config.units,
            height: 1,
            channels: 1,
            neurons,
        };
        layerDescriptors.push(desc);
        return desc;
    }

    private _buildUpsampleLayer(
        config: UpsampleLayerConfig,
        prev: ICnnLayerDescriptor,
        allNeurons: ICnnNeuron[],
        allSynapses: ICnnSynapse[],
        layerDescriptors: ICnnLayerDescriptor[],
        layerDepth: number
    ): ICnnLayerDescriptor {
        const [fH, fW] = toTuple(config.factor);
        const outH = prev.height * fH;
        const outW = prev.width * fW;

        const neurons: ICnnNeuron[] = [];

        for (let c = 0; c < prev.channels; c++) {
            for (let r = 0; r < outH; r++) {
                for (let col = 0; col < outW; col++) {
                    const neuron = this._createNeuron(CnnLayerType.Upsample, r, col, c, 0, undefined, undefined, new Cartesian3(col, r, layerDepth));
                    neurons.push(neuron);
                    allNeurons.push(neuron);

                    // Connect to the source neuron via nearest-neighbor: each output maps to one input
                    const srcRow = Math.floor(r / fH);
                    const srcCol = Math.floor(col / fW);
                    const srcNeuron = this._getNeuronAt(prev, srcRow, srcCol, c);
                    const synapse = this._createSynapse(srcNeuron, neuron, null, -1, 1);
                    allSynapses.push(synapse);
                }
            }
        }

        const desc: ICnnLayerDescriptor = {
            type: CnnLayerType.Upsample,
            width: outW,
            height: outH,
            channels: prev.channels,
            neurons,
        };
        layerDescriptors.push(desc);
        return desc;
    }

    private _buildReshapeLayer(
        config: ReshapeLayerConfig,
        prev: ICnnLayerDescriptor,
        allNeurons: ICnnNeuron[],
        allSynapses: ICnnSynapse[],
        layerDescriptors: ICnnLayerDescriptor[],
        layerDepth: number
    ): ICnnLayerDescriptor {
        const expectedSize = config.width * config.height * config.channels;
        const prevSize = prev.width * prev.height * prev.channels;
        if (expectedSize !== prevSize) {
            throw new Error(`Reshape size mismatch: previous layer has ${prevSize} units, reshape expects ${expectedSize}`);
        }

        const neurons: ICnnNeuron[] = [];
        let idx = 0;

        for (let c = 0; c < config.channels; c++) {
            for (let r = 0; r < config.height; r++) {
                for (let col = 0; col < config.width; col++) {
                    const neuron = this._createNeuron(CnnLayerType.Reshape, r, col, c, 0, undefined, undefined, new Cartesian3(col, r, layerDepth));
                    neurons.push(neuron);
                    allNeurons.push(neuron);

                    // 1-to-1 connection from flat layout
                    const srcNeuron = prev.neurons[idx];
                    const synapse = this._createSynapse(srcNeuron, neuron, null, -1, 1);
                    allSynapses.push(synapse);
                    idx++;
                }
            }
        }

        const desc: ICnnLayerDescriptor = {
            type: CnnLayerType.Reshape,
            width: config.width,
            height: config.height,
            channels: config.channels,
            neurons,
        };
        layerDescriptors.push(desc);
        return desc;
    }

    private _getNeuronAt(desc: ICnnLayerDescriptor, row: number, col: number, channel: number): ICnnNeuron {
        // Neurons are stored in channel-major, then row, then col order
        const index = channel * desc.height * desc.width + row * desc.width + col;
        return desc.neurons[index];
    }

    // ── Concrete-class factories (override in subclasses) ─────────────────

    /**
     * Factory for CNN neurons. The base class returns a plain CnnNeuron.
     * Subclasses override to instantiate domain-specific neuron types
     * (e.g. StereoCnnNeuron) while keeping the layer-building logic
     * untouched.
     */
    protected _createNeuron(
        layerType: CnnLayerType,
        row: number,
        col: number,
        channel: number,
        bias: number,
        activation: IActivationFunction | undefined,
        poolType: PoolingType | undefined,
        position: Cartesian3
    ): ICnnNeuron {
        return new CnnNeuron(layerType, row, col, channel, bias, activation, poolType, null, null, position);
    }

    /**
     * Factory for CNN synapses. The base class returns a plain
     * CnnSynapse. Subclasses override for custom synapse types.
     */
    protected _createSynapse(source: ICnnNeuron, target: ICnnNeuron, kernel: IConvKernel | null, kernelIndex: number, directWeight: number = 0): ICnnSynapse {
        return new CnnSynapse(source, target, kernel, kernelIndex, directWeight);
    }

    /**
     * Factory for convolutional kernels. The base class returns a plain
     * ConvKernel. Subclasses override to instantiate custom kernels.
     */
    protected _createKernel(kernelHeight: number, kernelWidth: number, inputChannels: number, initializer: IWeightInitializer, bias: number): IConvKernel {
        return new ConvKernel(kernelHeight, kernelWidth, inputChannels, initializer, bias);
    }

    /**
     * Factory for the final CNN graph object. The base class returns a
     * plain CnnGraph. Subclasses override to instantiate custom graph
     * types (e.g. IStereoCnnGraph with extra metadata).
     */
    protected _createGraph(
        neurons: ICnnNeuron[],
        synapses: ICnnSynapse[],
        inputs: ICnnNeuron[],
        outputs: ICnnNeuron[],
        hiddens: ICnnNeuron[],
        kernels: IConvKernel[],
        layerDescriptors: ICnnLayerDescriptor[]
    ): ICnnGraph {
        return new CnnGraph(neurons, synapses, inputs, outputs, hiddens, null, null, undefined, kernels, layerDescriptors);
    }
}
