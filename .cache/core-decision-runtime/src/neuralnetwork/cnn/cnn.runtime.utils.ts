import { ICnnNeuron, ICnnSynapse, ICnnInferenceContext } from "./cnn.interfaces";

export class CnnRuntimeUtils {
    public static resetInferenceContext(neuron: ICnnNeuron): void {
        if (!neuron.bag) {
            const numInputs = neuron.opsc<ICnnSynapse>()?.length ?? 0;
            neuron.bag = { sum: 0, activation: 0, remainingInputs: numInputs, totalInputs: numInputs };
        } else {
            const bag = neuron.bag as ICnnInferenceContext;
            bag.sum = 0;
            bag.activation = 0;
            bag.remainingInputs = bag.totalInputs;
        }
    }
}
