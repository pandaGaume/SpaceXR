import { INode, IOlink, LinkBuilder } from "../graph";
import { ILayer, ILayerConnection, INeuron, ISynapse, LayerConnectionType } from "./nn.interfaces";
import { ILayerConnectionBuilder, ISynapseBuilder } from "./nn.interfaces.builder";
import { Synapse } from "./nn.synapse";
import { IWeightInitializer, Uniform } from "./nn.weights";

/**
 * Base builder for the concrete Synapse class. Subclasses (e.g.
 * MlpSynapseBuilder) extend this and override _createLink() to
 * instantiate their own synapse type; build() takes care of validating
 * endpoints and applying the configured weight.
 */
export class SynapseBuilder extends LinkBuilder implements ISynapseBuilder {
    protected _weight: number = 0.0; // Default weight

    public withWeight(weight: number): this {
        this._weight = weight;
        return this;
    }

    public override build(): ISynapse {
        return super.build() as ISynapse;
    }

    protected override _createLink(from: INode, to: INode): IOlink {
        return this._createSynapse(from, to);
    }

    /**
     * Factory for the concrete synapse class. Subclass builders
     * override this to instantiate their own synapse type. The weight
     * value passed comes from `withWeight()`; the base implementation
     * builds a plain `Synapse(from, to, weight)`.
     */
    protected _createSynapse(from: INode, to: INode): ISynapse {
        return new Synapse(from, to, this._weight);
    }
}

export class LayerConnectionBuilder implements ILayerConnectionBuilder {
    private _type: LayerConnectionType = LayerConnectionType.FullyConnected; // Default connection type
    private _weightInitializer: IWeightInitializer = new Uniform(); // Default weight initializer
    private _synapseBuilder: SynapseBuilder = new SynapseBuilder(); // Default synapse builder

    public withType(type: LayerConnectionType): ILayerConnectionBuilder {
        this._type = type;
        return this;
    }

    public withWeightInitializer(initializer: IWeightInitializer): ILayerConnectionBuilder {
        this._weightInitializer = initializer;
        return this;
    }

    public withSynapseBuilder(builder: SynapseBuilder): ILayerConnectionBuilder {
        this._synapseBuilder = builder;
        return this;
    }

    build(source: ILayer<INeuron>, target: ILayer<INeuron>): ILayerConnection<ISynapse> | undefined {
        switch (this._type) {
            case LayerConnectionType.FullyConnected:
                return this.buildFullConnection(source, target);
            case LayerConnectionType.OneToOne:
                return this.buildOneToOneConnection(source, target);
            default:
                return undefined;
        }
    }

    private buildFullConnection(source: ILayer<INeuron>, target: ILayer<INeuron>): ILayerConnection<ISynapse> {
        const synapses: Array<ISynapse> = [];
        for (const sourceNeuron of source) {
            for (const targetNeuron of target) {
                const synapse = this._synapseBuilder.withWeight(this._weightInitializer.next()).withFrom(sourceNeuron).withTo(targetNeuron).build() as ISynapse;
                synapses.push(synapse);
            }
        }
        return synapses;
    }

    private buildOneToOneConnection(source: ILayer<INeuron>, target: ILayer<INeuron>): ILayerConnection<ISynapse> | undefined {
        if (source.length !== target.length) {
            throw new Error("Source and target layers must have the same number of neurons for one-to-one connection.");
        }
        const synapses: ILayerConnection<ISynapse> = [];
        for (let i = 0; i < source.length; i++) {
            const synapse = this._synapseBuilder.withWeight(this._weightInitializer.next()).withFrom(source[i]).withTo(target[i]).build() as ISynapse;
            synapses.push(synapse);
        }
        return synapses;
    }
}
