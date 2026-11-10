import { IMlpNeuron, IMlpSynapse, isMlpNeuron } from "./mlp.interfaces";

export class MLPRuntimeUtils {
    public static resetInferenceContext(neuron: IMlpNeuron): void {
        const numInputs = neuron.opsc<IMlpSynapse>()?.length ?? 0;
        if (!neuron.bag) {
            neuron.bag = { sum: 0, activation: 0, remainingInputs: numInputs, totalInputs: numInputs };
        } else {
            neuron.bag.sum = 0;
            neuron.bag.activation = 0;
            neuron.bag.remainingInputs = neuron.bag.totalInputs;
        }
    }

    public static resetBackpropContext(item: IMlpNeuron | IMlpSynapse): void {
        if (isMlpNeuron(item)) {
            // Backprop fields are optional in IBackpropNeuronContext; reset
            // them on existing bag. A fresh bag is initialized by the
            // inference pass via resetInferenceContext().
            if (item.bag) {
                item.bag.error = 0;
                item.bag.gradient = 0;
            }
            return;
        }
        if (!item.bag) {
            item.bag = {
                gradient: 0,
                velocity: 0,
                m: 0,
                v: 0,
                prelookedWeight: 0,
                weightDelta: 0,
            };
        } else {
            item.bag.gradient = 0;
            item.bag.velocity = 0;
            item.bag.m = 0;
            item.bag.v = 0;
            item.bag.prelookedWeight = 0;
            item.bag.weightDelta = 0;
        }
    }
}
