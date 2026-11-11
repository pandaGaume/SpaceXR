import { INode } from "../../../graph";
import { Synapse } from "../../nn.synapse";
import { IMlpSynapse } from "./mlp.interfaces";
import type { IBackpropSynapseContext } from "../../nn.training";

export class MlpSynapse extends Synapse<IBackpropSynapseContext> implements IMlpSynapse {
    public constructor(oini: INode, ofin: INode) {
        super(oini, ofin);
    }
}
