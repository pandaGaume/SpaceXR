import { ICartesian } from "../../../geometry";
import { cloneable, IOlink } from "../../../graph";
import { Nullable } from "../../../types";
import { Neuron } from "../../nn.neuron";
import { IActivationFunction, IMlpNeuron } from "./mlp.interfaces";
import type { IBackpropNeuronContext } from "./training/mlp.training.interfaces";

export class MlpNeuron extends Neuron<IBackpropNeuronContext> implements IMlpNeuron {
    @cloneable public bias: number = 0;
    @cloneable activationFn?: IActivationFunction | undefined;

    public constructor(bias: number = 0, activation?: IActivationFunction, onsc: Nullable<IOlink[]> = null, opsc: Nullable<IOlink[]> = null, position?: ICartesian) {
        super(onsc, opsc, position);
        this.bias = bias;
        this.activationFn = activation;
    }
}
