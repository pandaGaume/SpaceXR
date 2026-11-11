import { ICartesian } from "../../geometry";
import { cloneable, IOlink } from "../../graph";
import { Nullable } from "../../types";
import { Neuron } from "../nn.neuron";
import { CnnLayerType, ICnnNeuron, PoolingType } from "./cnn.interfaces";
import type { IActivationFunction } from "../ann/mlp/mlp.interfaces";
import type { ICnnBackpropNeuronContext } from "./training/cnn.training.interfaces";

export class CnnNeuron extends Neuron<ICnnBackpropNeuronContext> implements ICnnNeuron {
    @cloneable public layerType: CnnLayerType;
    @cloneable public bias: number;
    @cloneable public activationFn?: IActivationFunction;
    @cloneable public poolType?: PoolingType;
    @cloneable public row: number;
    @cloneable public col: number;
    @cloneable public channel: number;

    public constructor(
        layerType: CnnLayerType,
        row: number = 0,
        col: number = 0,
        channel: number = 0,
        bias: number = 0,
        activationFn?: IActivationFunction,
        poolType?: PoolingType,
        onsc: Nullable<IOlink[]> = null,
        opsc: Nullable<IOlink[]> = null,
        position?: ICartesian
    ) {
        super(onsc, opsc, position);
        this.layerType = layerType;
        this.row = row;
        this.col = col;
        this.channel = channel;
        this.bias = bias;
        this.activationFn = activationFn;
        this.poolType = poolType;
    }
}
