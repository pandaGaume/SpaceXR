import { readyQueueDispatch } from "../../../graph";
import { ActivationFunctions } from "./mlp.activation";
import { IMlpGraph, IMlpNeuron, IMlpSynapse, IActivationFunction } from "./mlp.interfaces";
import { MLPRuntimeUtils } from "./mlp.runtime.utils";

export class MLPInferenceRuntime {
    public constructor(
        public readonly graph: IMlpGraph,
        public mainActivation: IActivationFunction = ActivationFunctions.relu
    ) {}

    /**
     * Runs inference on the MLP graph given an array of input values.
     * The number of input values must match the number of input neurons.
     */
    run(inputValues: number[]): number[] {
        if (inputValues.length !== this.graph.inputs.length) {
            throw new Error(`Input count mismatch: expected ${this.graph.inputs.length}, got ${inputValues.length}`);
        }

        // Initialize context for all neurons (sum=0, remainingInputs=fan-in).
        for (const neuron of this.graph.nodes) {
            MLPRuntimeUtils.resetInferenceContext(neuron);
        }

        // Inject input values into the input neurons' bag. Their
        // remainingInputs is forced to 0 so the dispatcher seeds them.
        const seed: IMlpNeuron[] = [];
        for (let i = 0; i < inputValues.length; i++) {
            const neuron = this.graph.inputs[i];
            const ctx = neuron.bag!;
            ctx.sum = inputValues[i];
            ctx.activation = inputValues[i];
            ctx.remainingInputs = 0;
            seed.push(neuron);
        }

        // Generic ready-queue dispatch: the helper manages the FIFO and
        // counter decrement; we provide the MLP-specific accumulate and
        // fire bodies.
        readyQueueDispatch<IMlpNeuron, IMlpSynapse>(this.graph, {
            seed,
            getCount: (n) => n.bag!.remainingInputs,
            setCount: (n, c) => {
                n.bag!.remainingInputs = c;
            },
            propagate: (source, target, syn) => {
                target.bag!.sum += source.bag!.activation * syn.weight;
            },
            fire: (n) => {
                const ctx = n.bag!;
                ctx.sum += n.bias;
                const afn = n.activationFn ?? this.mainActivation;
                ctx.activation = afn.fn(ctx.sum);
            },
        });

        return this.graph.outputs.map((n) => n.bag!.activation);
    }

    public clearContext() {
        for (const neuron of this.graph.nodes) {
            MLPRuntimeUtils.resetInferenceContext(neuron);
        }
    }
    public deleteContext() {
        for (const neuron of this.graph.nodes) {
            neuron.bag = undefined;
        }
    }
}
