import { ICartesian } from "../../../geometry";
import { Graph } from "../../../graph";
import { Nullable } from "../../../types";
import { IMlpGraph, IMlpNeuron, IMlpSynapse } from "./mlp.interfaces";

export class MlpGraph extends Graph<IMlpNeuron, IMlpSynapse> implements IMlpGraph {
    public constructor(
        nodes: IMlpNeuron[] = [],
        links: IMlpSynapse[] = [],
        inputs: Nullable<IMlpNeuron[]> = null,
        outputs: Nullable<IMlpNeuron[]> = null,
        hiddens: Nullable<IMlpNeuron[]> = null,
        onsc: Nullable<IMlpSynapse[]> = null,
        opsc: Nullable<IMlpSynapse[]> = null,
        position?: ICartesian
    ) {
        super(nodes, links, inputs, outputs, hiddens, onsc, opsc, position);
    }
}
