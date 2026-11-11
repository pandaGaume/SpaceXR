import { ICartesian } from "../../../geometry";
import { GraphBuilder, GraphNodeBuilder, INode, IOlink } from "../../../graph";
import { Nullable } from "../../../types";
import { LayerConnectionBuilder } from "../../nn.builders";
import { ILayer } from "../../nn.interfaces";
import { ILayerConnectionBuilder } from "../../nn.interfaces.builder";

import { IActivationFunction, IMlpGraph, IMlpNeuron } from "./mlp.interfaces";
import { MlpNeuron } from "./mlp.neuron";

export class MlpNeuronBuilder extends GraphNodeBuilder {
    protected _bias?: number;
    protected _activationFn?: IActivationFunction;

    public withBias(bias: number): MlpNeuronBuilder {
        this._bias = bias;
        return this;
    }
    public withActivationFn(fn: IActivationFunction): MlpNeuronBuilder {
        this._activationFn = fn;
        return this;
    }
    public override build(): IMlpNeuron {
        if (this._bias === undefined) {
            throw new Error("Bias must be provided.");
        }
        if (this._activationFn === undefined) {
            throw new Error("Activation function must be provided.");
        }
        return super.build() as IMlpNeuron;
    }

    protected override _createNode(onsc: Nullable<IOlink[]>, opsc: Nullable<IOlink[]>, position?: ICartesian): INode {
        return new MlpNeuron(this._bias!, this._activationFn!, onsc, opsc, position);
    }
}

export class MlpLayerBuilder {
    _count: number = 0;
    _neuronBuilder?: MlpNeuronBuilder;

    public withNeuron(bias: number | MlpNeuronBuilder, fn?: IActivationFunction): MlpLayerBuilder {
        if (bias instanceof MlpNeuronBuilder) {
            this._neuronBuilder = bias;
            return this;
        }
        this._neuronBuilder = this._neuronBuilder ?? new MlpNeuronBuilder();
        this._neuronBuilder.withBias(bias);
        if (fn) {
            this._neuronBuilder.withActivationFn(fn);
        }
        return this;
    }

    public withCount(count: number): MlpLayerBuilder {
        this._count = count;
        return this;
    }

    public build(): ILayer<IMlpNeuron> {
        if (!this._neuronBuilder) {
            throw new Error("Neuron builder is not defined. Please set it using withNeuron() method.");
        }
        if (this._count <= 0) {
            throw new Error("Neuron count must be greater than zero.");
        }
        const neurons: ILayer<IMlpNeuron> = [];
        for (let i = 0; i < this._count; i++) {
            neurons.push(this._neuronBuilder.build());
        }
        return neurons;
    }
}

export class PerceptronBuilder {
    _inputLayerBuilder: MlpLayerBuilder = new MlpLayerBuilder();
    _hiddenLayerBuilders: Array<MlpLayerBuilder> = [];
    _outputLayerBuilder: MlpLayerBuilder = new MlpLayerBuilder();
    _hiddenLayerCount: number = 0;
    _layerCount: number = 0;
    _defaultLayerConnBuilder: ILayerConnectionBuilder = new LayerConnectionBuilder();
    _connectionBuilders: Array<{ conn: ILayerConnectionBuilder; from: number; to: number }> = [];

    public withInputLayer(count: number | MlpLayerBuilder, bias?: number, activation?: IActivationFunction): PerceptronBuilder {
        if (count instanceof MlpLayerBuilder) {
            this._inputLayerBuilder = count;
            this._layerCount++;
            return this;
        }
        if (bias === undefined || activation === undefined) {
            throw new Error("Bias and activation function must be provided when using count.");
        }
        this._inputLayerBuilder = this._inputLayerBuilder ?? new MlpLayerBuilder();
        this._inputLayerBuilder.withCount(count).withNeuron(bias, activation);
        this._layerCount++;
        return this;
    }

    public withHiddenLayer(
        count: number | MlpLayerBuilder | [{ count: number; bias?: number; activation?: IActivationFunction; conn?: ILayerConnectionBuilder }],
        bias?: number,
        activation?: IActivationFunction
    ): PerceptronBuilder {
        if (count instanceof MlpLayerBuilder) {
            this._hiddenLayerBuilders[this._hiddenLayerCount] = count;
            this._layerCount++;
            return this;
        }
        if (Array.isArray(count)) {
            for (const layer of count) {
                this.withHiddenLayer(layer.count, layer.bias, layer.activation);
                if (layer.conn) {
                    this.withConnectionBuilder(layer.conn);
                }
            }
            return this;
        }
        if (bias === undefined || activation === undefined) {
            throw new Error("Bias and activation function must be provided when using count.");
        }
        this._hiddenLayerBuilders[this._hiddenLayerCount] = this._hiddenLayerBuilders[this._hiddenLayerCount] ?? new MlpLayerBuilder();
        this._hiddenLayerBuilders[this._hiddenLayerCount].withCount(count).withNeuron(bias, activation);
        this._layerCount++;
        return this;
    }

    public withOutputLayer(count: number | MlpLayerBuilder, bias?: number, activation?: IActivationFunction): PerceptronBuilder {
        if (count instanceof MlpLayerBuilder) {
            this._outputLayerBuilder = count;
            this._layerCount++;
            return this;
        }
        if (bias === undefined || activation === undefined) {
            throw new Error("Bias and activation function must be provided when using count.");
        }
        this._outputLayerBuilder = this._outputLayerBuilder ?? new MlpLayerBuilder();
        this._outputLayerBuilder.withCount(count).withNeuron(bias, activation);
        this._layerCount++;
        return this;
    }

    public withConnectionBuilder(connBuilder?: ILayerConnectionBuilder, from?: number, to?: number): PerceptronBuilder {
        const b = connBuilder ?? this._defaultLayerConnBuilder ?? new LayerConnectionBuilder();
        const f = from !== undefined ? from : this._layerCount - 2;
        const t = to !== undefined ? to : this._layerCount - 1;
        if (f >= 0 && t >= 0) {
            this._connectionBuilders.push({ conn: b, from: f, to: t });
        }
        return this;
    }

    public withDefaultConnectionBuilder(conn: ILayerConnectionBuilder): PerceptronBuilder {
        this._defaultLayerConnBuilder = conn;
        return this;
    }

    public build(): IMlpGraph {
        const builder = new GraphBuilder();

        const layers = [];
        layers.push(this._inputLayerBuilder.build());
        layers.push(...this._hiddenLayerBuilders.map((b) => b.build()));
        layers.push(this._outputLayerBuilder.build());

        for (let i = 0; i !== this._connectionBuilders.length; i++) {
            let layerIndex = this._connectionBuilders[i].from;
            if (layerIndex < 0 || layerIndex >= layers.length) {
                continue;
            }
            const a = layers[layerIndex];
            layerIndex = this._connectionBuilders[i].to;
            if (layerIndex < 0 || layerIndex >= layers.length) {
                continue;
            }
            const b = layers[layerIndex];
            const links = this._connectionBuilders[i].conn.build(a, b);
            if (links) builder.withLinks(...links);
        }

        builder.withNodes(...layers.flat());

        const g = builder.build() as unknown as IMlpGraph;
        return g;
    }

    public reset(): PerceptronBuilder {
        this._inputLayerBuilder = new MlpLayerBuilder();
        this._hiddenLayerBuilders = [];
        this._outputLayerBuilder = new MlpLayerBuilder();
        this._hiddenLayerCount = 0;
        this._defaultLayerConnBuilder = new LayerConnectionBuilder();
        this._connectionBuilders = [];
        return this;
    }
}
