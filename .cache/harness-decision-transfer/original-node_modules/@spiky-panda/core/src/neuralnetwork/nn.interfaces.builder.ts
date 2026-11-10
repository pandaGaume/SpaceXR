import { ILinkBuilder } from "../graph";
import { SynapseBuilder } from "./nn.builders";
import { ILayer, ILayerConnection, INeuron, ISynapse, LayerConnectionType } from "./nn.interfaces";
import { IWeightInitializer } from "./nn.weights";

export interface ISynapseBuilder extends ILinkBuilder {
    withWeight(weight: number): ISynapseBuilder;
}

export interface ISynapseBuilderConstructor<T extends ISynapseBuilder> {
    new (weight?: number): T;
}

export interface ILayerConnectionBuilder {
    withType(type: LayerConnectionType): ILayerConnectionBuilder;
    withWeightInitializer(initializer: IWeightInitializer): ILayerConnectionBuilder;
    withSynapseBuilder(builder: SynapseBuilder): ILayerConnectionBuilder;
    build(source: ILayer<INeuron>, target: ILayer<INeuron>): ILayerConnection<ISynapse> | undefined;
}
