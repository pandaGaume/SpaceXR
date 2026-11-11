import { IInferenceNeuronContext } from "../mlp.interfaces";

export type { IBackpropSynapseContext, ILossFunction, IOptimizer, ITrainingContext } from "../../../nn.training";

export interface IBackpropNeuronContext extends IInferenceNeuronContext {
    error?: number;
    gradient?: number;
}
