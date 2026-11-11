import { INode } from "../../../graph";
import { SynapseBuilder } from "../../nn.builders";
import { MlpSynapse } from "./mlp.synapse";
import { ISynapse } from "../../nn.interfaces";

/**
 * Builder for MlpSynapse instances. Extends SynapseBuilder and overrides
 * _createSynapse() to instantiate an MlpSynapse with the requested
 * weight. Use this in place of the legacy
 * `new SynapseBuilder().withType(MlpSynapse)` pattern.
 */
export class MlpSynapseBuilder extends SynapseBuilder {
    protected override _createSynapse(from: INode, to: INode): ISynapse {
        const synapse = new MlpSynapse(from, to);
        synapse.weight = this._weight;
        return synapse;
    }
}
