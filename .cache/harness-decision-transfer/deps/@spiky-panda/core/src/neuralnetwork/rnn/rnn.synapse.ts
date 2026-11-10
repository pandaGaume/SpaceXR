import { cloneable, GraphOLink, INode } from "../../graph";
import { IRnnSynapse } from "./rnn.interfaces";

/// <summary>
/// RNN synapse carrying multiple weights, one per gate.
/// LSTM synapses have 4 weights: [forget, input, candidate, output]
/// GRU synapses have 3 weights: [reset, update, candidate]
///
/// The base ISynapse.weight property maps to weights[0] for compatibility
/// with the existing optimizer infrastructure.
/// </summary>
export class RnnSynapse extends GraphOLink implements IRnnSynapse {
    @cloneable public weights: number[];

    public constructor(oini: INode, ofin: INode, numGates: number = 4) {
        super(oini, ofin);
        this.weights = new Array(numGates).fill(0);
    }

    /// <summary>
    /// Compatibility accessor - maps to weights[0].
    /// The optimizer uses this property, so for RNN we apply gradients per-gate separately.
    /// </summary>
    public get weight(): number {
        return this.weights[0];
    }
    public set weight(v: number) {
        this.weights[0] = v;
    }
}
