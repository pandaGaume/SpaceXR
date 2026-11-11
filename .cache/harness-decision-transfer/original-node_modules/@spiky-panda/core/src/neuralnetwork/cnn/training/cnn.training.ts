import { IBackpropSynapseContext, ILossFunction, IOptimizer, ITrainingContext } from "../../nn.training";
import { CnnLayerType, ICnnGraph, ICnnNeuron, ICnnSynapse, IConvKernel, PoolingType } from "../cnn.interfaces";
import { CnnInferenceRuntime } from "../cnn.inference";
import { ICnnBackpropNeuronContext, KernelWeightSlot, KernelBiasSlot } from "./cnn.training.interfaces";

/// <summary>
/// Handles backpropagation and weight updates for a CNN graph.
/// Supports conv (with shared kernel weights), pool, flatten, and dense layers.
/// </summary>
export class CnnTrainingRuntime {
    private _context: ITrainingContext = { iteration: 0 };

    // Pre-allocated optimizer proxy slots for kernel weights and biases
    private _kernelWeightSlots: Map<IConvKernel, KernelWeightSlot[]> = new Map();
    private _kernelBiasSlots: Map<IConvKernel, KernelBiasSlot> = new Map();
    // Maps each kernel to the conv neurons that use it (for bias sync)
    private _kernelNeuronMap: Map<IConvKernel, ICnnNeuron[]> = new Map();

    public constructor(
        public readonly graph: ICnnGraph,
        public readonly runtime: CnnInferenceRuntime,
        public readonly lossFn: ILossFunction,
        public readonly learningRate: number,
        public readonly optimizer: IOptimizer
    ) {
        this._initKernelMaps();
    }

    private _initKernelMaps(): void {
        for (const kernel of this.graph.kernels) {
            // Weight slots
            const slots: KernelWeightSlot[] = [];
            for (let i = 0; i < kernel.weights.length; i++) {
                slots.push(new KernelWeightSlot(kernel, i));
            }
            this._kernelWeightSlots.set(kernel, slots);

            // Bias slot
            this._kernelBiasSlots.set(kernel, new KernelBiasSlot(kernel));

            // Neuron map
            this._kernelNeuronMap.set(kernel, []);
        }

        // Map conv neurons to their kernels
        for (const desc of this.graph.layerDescriptors) {
            if (desc.type === CnnLayerType.Conv) {
                for (const neuron of desc.neurons) {
                    // Find kernel via any incoming conv synapse
                    const inSynapses = neuron.opsc<ICnnSynapse>() ?? [];
                    for (const syn of inSynapses) {
                        if (syn.kernel) {
                            const arr = this._kernelNeuronMap.get(syn.kernel);
                            if (arr && !arr.includes(neuron)) {
                                arr.push(neuron);
                            }
                            break;
                        }
                    }
                }
            }
        }
    }

    public trainStep(inputs: number[], expected: number[]): number {
        const outputs = this.runtime.run(inputs);
        const loss = this._backpropagate(outputs, expected);
        this._applyGradients();
        this._context.iteration++;
        return loss;
    }

    private _backpropagate(outputs: number[], expected: number[]): number {
        let totalLoss = 0;

        // Initialize backprop context for all neurons (reuse inference bag, extend with gradient)
        for (const neuron of this.graph.nodes) {
            const bag = neuron.bag as ICnnBackpropNeuronContext;
            bag.error = 0;
            bag.gradient = 0;
        }

        // STEP 1 — Output layer: compute loss and gradient
        const hasChannelWeights = typeof (this.lossFn as any).setCurrentIndex === "function";
        for (let i = 0; i < this.graph.outputs.length; i++) {
            const neuron = this.graph.outputs[i];
            const bag = neuron.bag as ICnnBackpropNeuronContext;
            const o = bag.activation;
            const y = expected[i];

            if (hasChannelWeights) (this.lossFn as any).setCurrentIndex(i);
            totalLoss += this.lossFn.loss(o, y);

            const dLoss = this.lossFn.dLoss(o, y);
            const activationPrime = (neuron.activationFn ?? this.runtime.mainActivation).derivative;
            bag.gradient = dLoss * activationPrime(o);
            bag.error = y - o;
        }

        // STEP 2 — Hidden layers in reverse order
        const descs = this.graph.layerDescriptors;
        for (let layerIdx = descs.length - 2; layerIdx >= 1; layerIdx--) {
            const desc = descs[layerIdx];

            switch (desc.type) {
                case CnnLayerType.Dense:
                case CnnLayerType.Conv:
                    this._backpropActivationLayer(desc.neurons);
                    break;
                case CnnLayerType.Flatten:
                case CnnLayerType.Upsample:
                case CnnLayerType.Reshape:
                    this._backpropFlatten(desc.neurons);
                    break;
                case CnnLayerType.Pool:
                    this._backpropPool(desc.neurons);
                    break;
            }
        }

        return totalLoss;
    }

    private _backpropActivationLayer(neurons: ICnnNeuron[]): void {
        for (const neuron of neurons) {
            const bag = neuron.bag as ICnnBackpropNeuronContext;
            const activation = bag.activation;
            const activationPrime = (neuron.activationFn ?? this.runtime.mainActivation).derivative;

            let downstreamSum = 0;
            for (const syn of neuron.onsc<ICnnSynapse>() ?? []) {
                const target = syn.ofin as ICnnNeuron;
                const targetBag = target.bag as ICnnBackpropNeuronContext;

                if (target.layerType === CnnLayerType.Pool) {
                    // Pool neurons don't use synapse weights — gradient routing handled in _backpropPool
                    // The pool already set gradients on its inputs via _backpropPool
                    // Skip here to avoid double-counting
                    continue;
                }

                downstreamSum += syn.weight * (targetBag.gradient ?? 0);
            }

            // If this neuron feeds into pool layers, its gradient was already set by _backpropPool
            // We add the downstream sum from non-pool targets
            const poolGrad = bag.gradient ?? 0; // may have been set by pool backprop
            bag.gradient = activationPrime(activation) * downstreamSum + poolGrad;
        }
    }

    private _backpropFlatten(neurons: ICnnNeuron[]): void {
        for (const neuron of neurons) {
            const bag = neuron.bag as ICnnBackpropNeuronContext;

            let downstreamSum = 0;
            for (const syn of neuron.onsc<ICnnSynapse>() ?? []) {
                const target = syn.ofin as ICnnNeuron;
                const targetBag = target.bag as ICnnBackpropNeuronContext;
                downstreamSum += syn.weight * (targetBag.gradient ?? 0);
            }

            bag.gradient = downstreamSum;
        }
    }

    private _backpropPool(neurons: ICnnNeuron[]): void {
        for (const neuron of neurons) {
            const bag = neuron.bag as ICnnBackpropNeuronContext;

            // Compute downstream gradient for this pool neuron
            let downstreamSum = 0;
            for (const syn of neuron.onsc<ICnnSynapse>() ?? []) {
                const target = syn.ofin as ICnnNeuron;
                const targetBag = target.bag as ICnnBackpropNeuronContext;

                if (target.layerType === CnnLayerType.Pool) {
                    continue;
                }

                downstreamSum += syn.weight * (targetBag.gradient ?? 0);
            }
            // If pool feeds into flatten, flatten gradient was already computed
            // Check for flatten targets
            for (const syn of neuron.onsc<ICnnSynapse>() ?? []) {
                const target = syn.ofin as ICnnNeuron;
                if (target.layerType === CnnLayerType.Flatten) {
                    const targetBag = target.bag as ICnnBackpropNeuronContext;
                    downstreamSum += targetBag.gradient ?? 0;
                }
            }
            bag.gradient = downstreamSum;

            // Route gradient to inputs
            const inSynapses = neuron.opsc<ICnnSynapse>() ?? [];

            if (neuron.poolType === PoolingType.Max) {
                // Find which input had the max activation
                let maxActivation = -Infinity;
                let maxNeuron: ICnnNeuron | null = null;
                for (const syn of inSynapses) {
                    const src = syn.oini as ICnnNeuron;
                    const srcBag = src.bag as ICnnBackpropNeuronContext;
                    if (srcBag.activation > maxActivation) {
                        maxActivation = srcBag.activation;
                        maxNeuron = src;
                    }
                }
                // Route entire gradient to max input
                if (maxNeuron) {
                    const maxBag = maxNeuron.bag as ICnnBackpropNeuronContext;
                    maxBag.gradient = (maxBag.gradient ?? 0) + (bag.gradient ?? 0);
                }
            } else {
                // Avg pool: distribute gradient equally
                const n = inSynapses.length;
                for (const syn of inSynapses) {
                    const src = syn.oini as ICnnNeuron;
                    const srcBag = src.bag as ICnnBackpropNeuronContext;
                    srcBag.gradient = (srcBag.gradient ?? 0) + (bag.gradient ?? 0) / n;
                }
            }
        }
    }

    private _applyGradients(): void {
        // 1. ConvKernel weight gradients — accumulate and apply
        for (const kernel of this.graph.kernels) {
            const slots = this._kernelWeightSlots.get(kernel)!;
            const neurons = this._kernelNeuronMap.get(kernel)!;

            // Accumulate weight gradients across all spatial positions
            const weightGrads = new Array(kernel.weights.length).fill(0);
            let biasGrad = 0;

            for (const neuron of neurons) {
                const neuronBag = neuron.bag as ICnnBackpropNeuronContext;
                const neuronGrad = neuronBag.gradient ?? 0;
                biasGrad += neuronGrad;

                // Each incoming conv synapse contributes to the kernel weight gradient
                for (const syn of neuron.opsc<ICnnSynapse>() ?? []) {
                    if (syn.kernel === kernel) {
                        const src = syn.oini as ICnnNeuron;
                        const srcBag = src.bag as ICnnBackpropNeuronContext;
                        weightGrads[syn.kernelIndex] += neuronGrad * srcBag.activation;
                    }
                }
            }

            // Apply optimizer to each kernel weight
            for (let i = 0; i < kernel.weights.length; i++) {
                this.optimizer.apply(slots[i] as any, this.learningRate, weightGrads[i], this._context);
            }

            // Apply optimizer to kernel bias, then sync to neurons
            const biasSlot = this._kernelBiasSlots.get(kernel)!;
            this.optimizer.apply(biasSlot as any, this.learningRate, biasGrad, this._context);
            for (const neuron of neurons) {
                neuron.bias = kernel.bias;
            }
        }

        // 2. Dense synapse weights
        for (const syn of this.graph.links) {
            if (syn.kernel !== null) continue; // Skip conv synapses (handled above)

            const target = syn.ofin as ICnnNeuron;
            if (target.layerType !== CnnLayerType.Dense) continue;

            const src = syn.oini as ICnnNeuron;
            const srcBag = src.bag as ICnnBackpropNeuronContext;
            const targetBag = target.bag as ICnnBackpropNeuronContext;

            const gradient = (targetBag.gradient ?? 0) * srcBag.activation;
            const synBag = (syn.bag ??= {}) as IBackpropSynapseContext;
            synBag.gradient = gradient;

            this.optimizer.apply(syn as any, this.learningRate, gradient, this._context);
        }

        // 3. Dense neuron biases
        for (const desc of this.graph.layerDescriptors) {
            if (desc.type !== CnnLayerType.Dense) continue;
            for (const neuron of desc.neurons) {
                const bag = neuron.bag as ICnnBackpropNeuronContext;
                if (bag.gradient !== undefined) {
                    neuron.bias -= this.learningRate * bag.gradient;
                }
            }
        }
    }

    public get trainingContext(): Readonly<ITrainingContext> {
        return this._context;
    }

    public clearContext(): void {
        for (const neuron of this.graph.nodes) {
            const bag = neuron.bag as ICnnBackpropNeuronContext | undefined;
            if (bag) {
                bag.error = 0;
                bag.gradient = 0;
            }
        }
        for (const syn of this.graph.links) {
            const bag = syn.bag as IBackpropSynapseContext | undefined;
            if (bag) {
                bag.gradient = 0;
            }
        }
    }

    public deleteContext(): void {
        for (const neuron of this.graph.nodes) {
            neuron.bag = undefined;
        }
        for (const syn of this.graph.links) {
            syn.bag = undefined;
        }
    }
}
