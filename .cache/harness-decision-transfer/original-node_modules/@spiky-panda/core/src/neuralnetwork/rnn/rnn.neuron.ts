import { ICartesian } from "../../geometry";
import { cloneable, IOlink } from "../../graph";
import { Nullable } from "../../types";
import { Neuron } from "../nn.neuron";
import { ILstmNeuron, IGruNeuron, ILstmInferenceContext, IGruInferenceContext, RnnCellType } from "./rnn.interfaces";

/// <summary>
/// LSTM neuron with 4 gates and a persistent cell state.
/// Gates: forget (f), input (i), candidate (c), output (o)
///
///   f = sigmoid(Wf * [h, x] + bf)
///   i = sigmoid(Wi * [h, x] + bi)
///   c~ = tanh(Wc * [h, x] + bc)
///   cellState = f * cellState + i * c~
///   o = sigmoid(Wo * [h, x] + bo)
///   h = o * tanh(cellState)
/// </summary>
export class LstmNeuron extends Neuron<ILstmInferenceContext> implements ILstmNeuron {
    @cloneable public cellType: RnnCellType = RnnCellType.LSTM;
    @cloneable public hiddenState: number = 0;
    @cloneable public cellState: number = 0;
    @cloneable public biasForget: number = 1.0; // Initialize forget bias > 0 to encourage remembering early on
    @cloneable public biasInput: number = 0;
    @cloneable public biasCandidate: number = 0;
    @cloneable public biasOutput: number = 0;

    public constructor(onsc: Nullable<IOlink[]> = null, opsc: Nullable<IOlink[]> = null, position?: ICartesian) {
        super(onsc, opsc, position);
    }

    /// <summary>
    /// Resets hidden and cell state for a new sequence.
    /// </summary>
    public resetState(): void {
        this.hiddenState = 0;
        this.cellState = 0;
    }

    public override reset(): void {
        super.reset();
        this.resetState();
    }
}

/// <summary>
/// GRU neuron with 2 gates and a persistent hidden state.
/// Simpler than LSTM with 3 weight groups instead of 4.
///
///   r = sigmoid(Wr * [h, x] + br)   -- reset gate
///   z = sigmoid(Wz * [h, x] + bz)   -- update gate
///   h~ = tanh(Wh * [r*h, x] + bh)   -- candidate
///   h = (1 - z) * h + z * h~
/// </summary>
export class GruNeuron extends Neuron<IGruInferenceContext> implements IGruNeuron {
    @cloneable public cellType: RnnCellType = RnnCellType.GRU;
    @cloneable public hiddenState: number = 0;
    @cloneable public biasReset: number = 0;
    @cloneable public biasUpdate: number = 0;
    @cloneable public biasCandidate: number = 0;

    public constructor(onsc: Nullable<IOlink[]> = null, opsc: Nullable<IOlink[]> = null, position?: ICartesian) {
        super(onsc, opsc, position);
    }

    /// <summary>
    /// Resets hidden state for a new sequence.
    /// </summary>
    public resetState(): void {
        this.hiddenState = 0;
    }

    public override reset(): void {
        super.reset();
        this.resetState();
    }
}
