import { IMlpGraph, IMlpNeuron, IMlpSynapse } from "../mlp.interfaces";
import { MLPInferenceRuntime } from "../mlp.inference";
import { IBackpropSynapseContext, ILossFunction, IOptimizer, ITrainingContext } from "./mlp.training.interfaces";
import { MLPRuntimeUtils } from "../mlp.runtime.utils";

/// <summary>
/// Handles backpropagation and weight updates for an MLP graph.
/// </summary>
export class MLPTrainingRuntime {
    private context: ITrainingContext = { iteration: 0 };

    constructor(
        public readonly graph: IMlpGraph,
        public readonly runtime: MLPInferenceRuntime,
        public readonly lossFn: ILossFunction,
        public readonly learningRate: number,
        public readonly optimizer: IOptimizer
    ) {}

    /// <summary>
    /// Runs a forward + backward pass and updates weights.
    /// </summary>
    public trainStep(inputs: number[], expected: number[]): number {
        const outputs = this.runtime.run(inputs);
        const loss = this._backpropagate(outputs, expected);
        this._applyGradients();
        this.context.iteration++;
        return loss;
    }

    /**
     * Performs backpropagation and stores gradients in neuron and synapse bags.
     * This version properly propagates gradients through all layers of the network.
     */
    private _backpropagate(outputs: number[], expected: number[]): number {
        let totalLoss = 0;

        // STEP 1 – Output layer: compute error and gradient
        for (let i = 0; i < this.graph.outputs.length; i++) {
            const neuron = this.graph.outputs[i] as IMlpNeuron;
            const y = expected[i];
            // Bag is always populated by the prior inference pass.
            const bag = neuron.bag!;
            const output = bag.activation;

            const loss = this.lossFn.loss(output, y);
            totalLoss += loss;

            const dLoss = this.lossFn.dLoss(output, y); // ∂L/∂o
            const activationPrime = (neuron.activationFn ?? this.runtime.mainActivation).derivative;

            bag.gradient = dLoss * activationPrime(output); // ∂L/∂z
            bag.error = y - output;
        }

        // STEP 2 – Hidden layer: compute gradients from output layer
        for (let i = this.graph.hiddens.length - 1; i >= 0; i--) {
            const neuron = this.graph.hiddens[i] as IMlpNeuron;
            const bag = neuron.bag!;
            const activation = bag.activation;
            const activationPrime = (neuron.activationFn ?? this.runtime.mainActivation).derivative;

            let downstreamSum = 0;
            for (const syn of neuron.onsc<IMlpSynapse>() ?? []) {
                const to = syn.ofin as IMlpNeuron;
                downstreamSum += syn.weight * (to.bag?.gradient ?? 0);
            }

            bag.gradient = activationPrime(activation) * downstreamSum;
        }

        // STEP 3 – Accumulate gradient on all synapses
        for (const syn of this.graph.links) {
            const from = syn.oini as IMlpNeuron;
            const to = syn.ofin as IMlpNeuron;
            const synBag: IBackpropSynapseContext = (syn.bag ??= {});
            synBag.gradient = (to.bag?.gradient ?? 0) * (from.bag?.activation ?? 0);
        }

        return totalLoss;
    }

    /// <summary>
    /// Applies weight updates using the selected optimizer.
    /// </summary>
    private _applyGradients(): void {
        // Update synapse weights
        for (const synapse of this.graph.links) {
            const gradient = synapse.bag?.gradient;
            if (gradient !== undefined) {
                this.optimizer.apply(synapse, this.learningRate, gradient, this.context);
            }
        }

        // Update neuron biases
        for (const neuron of this.graph.nodes) {
            const gradient = neuron.bag?.gradient;
            if (gradient !== undefined) {
                neuron.bias -= this.learningRate * gradient;
            }
        }
    }
    get trainingContext(): Readonly<ITrainingContext> {
        return this.context;
    }

    public clearContext() {
        for (const neuron of this.graph.nodes) {
            MLPRuntimeUtils.resetBackpropContext(neuron);
        }
        for (const synapse of this.graph.links) {
            MLPRuntimeUtils.resetBackpropContext(synapse);
        }
    }

    public deleteContext() {
        for (const neuron of this.graph.nodes) {
            neuron.bag = undefined;
        }
        for (const synapse of this.graph.links) {
            synapse.bag = undefined;
        }
    }
}
