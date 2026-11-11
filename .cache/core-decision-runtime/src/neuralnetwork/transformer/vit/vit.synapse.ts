import { cloneable, GraphOLink, INode } from "../../../graph";
import { IVitSynapse, VitSynapseType } from "./vit.interfaces";

/// <summary>
/// Vision Transformer synapse.
///
/// For QKV synapses: stores 3 weights [wQ, wK, wV] similar to how
/// RnnSynapse stores per-gate weights.
///
/// For all other types (Embed, Projection, MLP, Head): stores a single weight.
///
/// Residual synapses have weight = 1 and are not trainable.
///
/// The base ISynapse.weight property maps to weights[0] for compatibility
/// with the existing optimizer infrastructure.
/// </summary>
export class VitSynapse extends GraphOLink implements IVitSynapse {
    @cloneable public synapseType: VitSynapseType;
    @cloneable public weights: number[];

    public constructor(oini: INode, ofin: INode, synapseType: VitSynapseType = VitSynapseType.MLP, numWeights: number = 1) {
        super(oini, ofin);
        this.synapseType = synapseType;
        this.weights = new Array(numWeights).fill(0);
    }

    /// <summary>
    /// Compatibility accessor - maps to weights[0].
    /// </summary>
    public get weight(): number {
        return this.weights[0];
    }
    public set weight(v: number) {
        this.weights[0] = v;
    }
}
