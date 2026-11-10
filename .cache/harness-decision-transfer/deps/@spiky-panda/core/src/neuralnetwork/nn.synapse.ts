import { cloneable, GraphOLink, INode } from "../graph";
import { ISynapse } from "./nn.interfaces";

export class Synapse<B = unknown> extends GraphOLink<B> implements ISynapse<B> {
    @cloneable public weight: number = 0;
    public constructor(oini: INode, ofin: INode, weight: number = 0) {
        super(oini, ofin);
        this.weight = weight;
    }
}
