import { ICartesian } from "../../../geometry";
import { cloneable, IOlink } from "../../../graph";
import { Nullable } from "../../../types";
import { Neuron } from "../../nn.neuron";
import { IVitNeuron, VitNeuronType } from "./vit.interfaces";

/// <summary>
/// Vision Transformer neuron.
/// Each neuron belongs to a specific role in the ViT architecture:
///   - Input: raw pixel value
///   - PatchEmbed: linear projection of patch into embedding space
///   - ClassToken: learnable aggregation token
///   - Attention: computes Q/K/V and attention-weighted output
///   - MLP: feed-forward within transformer block
///   - Output: classification head
///
/// Spatial metadata (embedIndex, tokenIndex, blockIndex, headIndex)
/// identifies the neuron's position within the transformer structure.
/// </summary>
export class VitNeuron extends Neuron implements IVitNeuron {
    @cloneable public neuronType: VitNeuronType;
    @cloneable public bias: number;
    @cloneable public embedIndex: number;
    @cloneable public tokenIndex: number;
    @cloneable public blockIndex: number;
    @cloneable public headIndex: number;

    public constructor(
        neuronType: VitNeuronType = VitNeuronType.Input,
        bias: number = 0,
        embedIndex: number = -1,
        tokenIndex: number = -1,
        blockIndex: number = -1,
        headIndex: number = -1,
        onsc: Nullable<IOlink[]> = null,
        opsc: Nullable<IOlink[]> = null,
        position?: ICartesian
    ) {
        super(onsc, opsc, position);
        this.neuronType = neuronType;
        this.bias = bias;
        this.embedIndex = embedIndex;
        this.tokenIndex = tokenIndex;
        this.blockIndex = blockIndex;
        this.headIndex = headIndex;
    }
}
