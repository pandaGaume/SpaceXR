import { GraphOLink, INode } from "../../graph";
import { ICnnSynapse, IConvKernel } from "./cnn.interfaces";
import type { IBackpropSynapseContext } from "../nn.training";

/// <summary>
/// A CNN synapse. For conv layers, weight is delegated to a shared kernel.
/// For pool/flatten/dense layers, kernel is null and weight is stored directly.
/// </summary>
export class CnnSynapse extends GraphOLink<IBackpropSynapseContext> implements ICnnSynapse {
    public kernel: IConvKernel | null;
    public kernelIndex: number;
    private _directWeight: number;

    public constructor(oini: INode, ofin: INode, kernel: IConvKernel | null = null, kernelIndex: number = -1, directWeight: number = 0) {
        super(oini, ofin);
        this.kernel = kernel;
        this.kernelIndex = kernelIndex;
        this._directWeight = directWeight;
    }

    public get weight(): number {
        if (this.kernel && this.kernelIndex >= 0) {
            return this.kernel.weights[this.kernelIndex];
        }
        return this._directWeight;
    }

    public set weight(value: number) {
        if (this.kernel && this.kernelIndex >= 0) {
            this.kernel.weights[this.kernelIndex] = value;
        } else {
            this._directWeight = value;
        }
    }
}
