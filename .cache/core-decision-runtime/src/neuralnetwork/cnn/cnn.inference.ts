import { readyQueueDispatch } from "../../graph";
import { ActivationFunctions } from "../ann/mlp/mlp.activation";
import { CnnLayerType, IActivationFunction, ICnnGraph, ICnnNeuron, ICnnSynapse, PoolingType } from "./cnn.interfaces";
import { CnnRuntimeUtils } from "./cnn.runtime.utils";

/// <summary>
/// Forward-pass inference runtime for CNN graphs.
/// Input values are expected as a flat array in channel-last, row-major order:
///   [r0c0ch0, r0c0ch1, ..., r0c1ch0, ...] when input layer is stored channel-first internally.
/// The builder stores neurons in channel-major order (channel × height × width),
/// so input values should match: all channel-0 pixels, then channel-1, etc.
/// </summary>
export class CnnInferenceRuntime {
    public constructor(
        public readonly graph: ICnnGraph,
        public mainActivation: IActivationFunction = ActivationFunctions.relu
    ) {}

    public run(inputValues: number[]): number[] {
        if (inputValues.length !== this.graph.inputs.length) {
            throw new Error(`Input count mismatch: expected ${this.graph.inputs.length}, got ${inputValues.length}`);
        }

        // Initialize context for all neurons (sum=0, remainingInputs=fan-in).
        for (const neuron of this.graph.nodes) {
            CnnRuntimeUtils.resetInferenceContext(neuron);
        }

        // Inject input values; force remainingInputs=0 so the dispatcher
        // treats them as already-fired sources.
        const seed: ICnnNeuron[] = [];
        for (let i = 0; i < inputValues.length; i++) {
            const neuron = this.graph.inputs[i];
            const ctx = neuron.bag!;
            ctx.sum = inputValues[i];
            ctx.activation = inputValues[i];
            ctx.remainingInputs = 0;
            seed.push(neuron);
        }

        readyQueueDispatch<ICnnNeuron, ICnnSynapse>(this.graph, {
            seed,
            getCount: (n) => n.bag!.remainingInputs,
            setCount: (n, c) => {
                n.bag!.remainingInputs = c;
            },
            propagate: (source, target, syn) => {
                const sourceCtx = source.bag!;
                const targetCtx = target.bag!;
                // Per-layer accumulation policy.
                switch (target.layerType) {
                    case CnnLayerType.Conv:
                    case CnnLayerType.Dense:
                        targetCtx.sum += sourceCtx.activation * syn.weight;
                        break;
                    case CnnLayerType.Pool:
                        if (target.poolType === PoolingType.Max) {
                            if (targetCtx.remainingInputs === targetCtx.totalInputs) {
                                // First input -- initialise from this activation.
                                targetCtx.sum = sourceCtx.activation;
                            } else {
                                targetCtx.sum = Math.max(targetCtx.sum, sourceCtx.activation);
                            }
                        } else {
                            // Average: accumulate, divide at fire().
                            targetCtx.sum += sourceCtx.activation;
                        }
                        break;
                    case CnnLayerType.Flatten:
                    case CnnLayerType.Input:
                    case CnnLayerType.Upsample:
                    case CnnLayerType.Reshape:
                        targetCtx.sum = sourceCtx.activation;
                        break;
                }
            },
            fire: (n) => {
                const ctx = n.bag!;
                switch (n.layerType) {
                    case CnnLayerType.Conv:
                    case CnnLayerType.Dense: {
                        ctx.sum += n.bias;
                        const afn = n.activationFn ?? this.mainActivation;
                        ctx.activation = afn.fn(ctx.sum);
                        break;
                    }
                    case CnnLayerType.Pool: {
                        if (n.poolType === PoolingType.Avg) {
                            ctx.activation = ctx.sum / ctx.totalInputs;
                        } else {
                            // Max pool: sum already holds the max.
                            ctx.activation = ctx.sum;
                        }
                        break;
                    }
                    case CnnLayerType.Flatten:
                    case CnnLayerType.Input:
                    case CnnLayerType.Upsample:
                    case CnnLayerType.Reshape: {
                        ctx.activation = ctx.sum;
                        break;
                    }
                }
            },
        });

        return this.graph.outputs.map((n) => n.bag!.activation);
    }

    public clearContext(): void {
        for (const neuron of this.graph.nodes) {
            CnnRuntimeUtils.resetInferenceContext(neuron);
        }
    }

    public deleteContext(): void {
        for (const neuron of this.graph.nodes) {
            neuron.bag = undefined;
        }
    }
}
