import { ICartesian } from "../../geometry";
import { Graph } from "../../graph";
import { Nullable } from "../../types";
import { ICnnGraph, ICnnLayerDescriptor, ICnnNeuron, ICnnSynapse, IConvKernel } from "./cnn.interfaces";

export class CnnGraph extends Graph<ICnnNeuron, ICnnSynapse> implements ICnnGraph {
    public kernels: IConvKernel[];
    public layerDescriptors: ICnnLayerDescriptor[];

    public constructor(
        nodes: ICnnNeuron[] = [],
        links: ICnnSynapse[] = [],
        inputs: Nullable<ICnnNeuron[]> = null,
        outputs: Nullable<ICnnNeuron[]> = null,
        hiddens: Nullable<ICnnNeuron[]> = null,
        onsc: Nullable<ICnnSynapse[]> = null,
        opsc: Nullable<ICnnSynapse[]> = null,
        position?: ICartesian,
        kernels: IConvKernel[] = [],
        layerDescriptors: ICnnLayerDescriptor[] = []
    ) {
        super(nodes, links, inputs, outputs, hiddens, onsc, opsc, position);
        this.kernels = kernels;
        this.layerDescriptors = layerDescriptors;
    }
}
