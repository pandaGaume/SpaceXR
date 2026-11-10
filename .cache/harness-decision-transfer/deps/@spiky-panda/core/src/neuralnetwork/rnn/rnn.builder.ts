import { GraphBuilder } from "../../graph";
import { Synapse } from "../nn.synapse";
import { Neuron } from "../nn.neuron";
import { WeightInit } from "../nn.weights";
import { IActivationFunction } from "../ann/mlp/mlp.interfaces";
import { ActivationFunctions } from "../ann/mlp/mlp.activation";
import { MlpNeuron } from "../ann/mlp/mlp.neuron";
import { IRnnConfig, IRnnGraph, IRnnNeuron, RnnCellType } from "./rnn.interfaces";
import { LstmNeuron, GruNeuron } from "./rnn.neuron";
import { RnnSynapse } from "./rnn.synapse";
import { ISynapse } from "../nn.interfaces";

/// <summary>
/// Fluent builder for RNN networks (LSTM and GRU).
/// Creates a single-layer recurrent network with:
///   - Input layer (plain neurons, pass-through)
///   - Hidden layer (LSTM or GRU neurons with recurrent connections)
///   - Output layer (MLP neurons with configurable activation)
///
/// Usage:
///   const graph = new RnnBuilder()
///       .withInputSize(2)
///       .withHiddenSize(8)
///       .withOutputSize(1)
///       .withCellType(RnnCellType.LSTM)
///       .build();
/// </summary>
export class RnnBuilder {
    protected _inputSize: number = 0;
    protected _hiddenSize: number = 0;
    protected _outputSize: number = 0;
    protected _cellType: RnnCellType = RnnCellType.LSTM;
    protected _outputActivation: IActivationFunction = ActivationFunctions.sigmoid;

    public withInputSize(size: number): RnnBuilder {
        this._inputSize = size;
        return this;
    }

    public withHiddenSize(size: number): RnnBuilder {
        this._hiddenSize = size;
        return this;
    }

    public withOutputSize(size: number): RnnBuilder {
        this._outputSize = size;
        return this;
    }

    public withCellType(type: RnnCellType): RnnBuilder {
        this._cellType = type;
        return this;
    }

    public withOutputActivation(fn: IActivationFunction): RnnBuilder {
        this._outputActivation = fn;
        return this;
    }

    /// <summary>
    /// Build from a config object instead of fluent API.
    /// </summary>
    public withConfig(config: IRnnConfig): RnnBuilder {
        this._inputSize = config.inputSize;
        this._hiddenSize = config.hiddenSize;
        this._outputSize = config.outputSize;
        this._cellType = config.cellType;
        if (config.outputActivation) this._outputActivation = config.outputActivation;
        return this;
    }

    /// <summary>
    /// Builds the RNN graph.
    ///
    /// Structure:
    ///   Input neurons (plain) --[RnnSynapse]--> Hidden neurons (LSTM/GRU)
    ///   Hidden neurons --[RnnSynapse]--> Hidden neurons (recurrent)
    ///   Hidden neurons --[Synapse]--> Output neurons (MLP with activation)
    ///
    /// Weight initialization: Glorot for all connections.
    /// </summary>
    public build(): IRnnGraph {
        if (this._inputSize <= 0) throw new Error("Input size must be > 0");
        if (this._hiddenSize <= 0) throw new Error("Hidden size must be > 0");
        if (this._outputSize <= 0) throw new Error("Output size must be > 0");

        const numGates = this._cellType === RnnCellType.LSTM ? 4 : 3;

        // 1. Create neurons
        const inputNeurons: Neuron[] = [];
        for (let i = 0; i < this._inputSize; i++) {
            inputNeurons.push(this._createInputNeuron());
        }

        const hiddenNeurons: IRnnNeuron[] = [];
        for (let i = 0; i < this._hiddenSize; i++) {
            hiddenNeurons.push(this._createHiddenNeuron(this._cellType));
        }

        const outputNeurons: MlpNeuron[] = [];
        for (let i = 0; i < this._outputSize; i++) {
            outputNeurons.push(this._createOutputNeuron(this._outputActivation));
        }

        // 2. Create synapses
        const allSynapses: ISynapse[] = [];

        // Glorot initialization parameters
        const fanIn = this._inputSize + this._hiddenSize;
        const fanOut = this._hiddenSize;

        // Input -> Hidden (RnnSynapse with numGates weights)
        for (const inp of inputNeurons) {
            for (const hid of hiddenNeurons) {
                const syn = this._createRnnSynapse(inp, hid, numGates);
                for (let g = 0; g < numGates; g++) {
                    syn.weights[g] = WeightInit.Glorot(fanIn, fanOut);
                }
                allSynapses.push(syn);
            }
        }

        // Hidden -> Hidden recurrent (RnnSynapse with numGates weights)
        for (const hSrc of hiddenNeurons) {
            for (const hTgt of hiddenNeurons) {
                const syn = this._createRnnSynapse(hSrc, hTgt, numGates);
                for (let g = 0; g < numGates; g++) {
                    syn.weights[g] = WeightInit.Glorot(fanIn, fanOut);
                }
                allSynapses.push(syn);
            }
        }

        // Hidden -> Output (regular Synapse, single weight)
        for (const hid of hiddenNeurons) {
            for (const out of outputNeurons) {
                const syn = this._createOutputSynapse(hid, out, WeightInit.Glorot(this._hiddenSize, this._outputSize));
                allSynapses.push(syn);
            }
        }

        // 3. Assemble graph
        const allNodes = [...inputNeurons, ...hiddenNeurons, ...outputNeurons] as IRnnNeuron[];

        const builder = new GraphBuilder<IRnnNeuron, ISynapse>();
        builder.withNodes(...allNodes);
        builder.withLinks(...allSynapses);

        const graph = builder.build() as IRnnGraph;

        // Set inputs/outputs/hiddens on graph
        (graph as any).inputs = inputNeurons;
        (graph as any).outputs = outputNeurons;
        (graph as any).hiddens = hiddenNeurons;

        return graph;
    }

    public reset(): RnnBuilder {
        this._inputSize = 0;
        this._hiddenSize = 0;
        this._outputSize = 0;
        this._cellType = RnnCellType.LSTM;
        this._outputActivation = ActivationFunctions.sigmoid;
        return this;
    }

    // ── Concrete-class factories (override in subclasses) ─────────────────

    /** Factory for input-layer neurons. Plain pass-through neurons by default. */
    protected _createInputNeuron(): Neuron {
        return new Neuron();
    }

    /** Factory for hidden-layer neurons; dispatches on cell type. */
    protected _createHiddenNeuron(cellType: RnnCellType): IRnnNeuron {
        return cellType === RnnCellType.LSTM ? new LstmNeuron() : new GruNeuron();
    }

    /** Factory for output-layer neurons (MLP-style with configurable activation). */
    protected _createOutputNeuron(activation: IActivationFunction): MlpNeuron {
        return new MlpNeuron(0, activation);
    }

    /** Factory for RnnSynapse instances (multi-gate weighted edges in/around the hidden layer). */
    protected _createRnnSynapse(source: Neuron | IRnnNeuron, target: IRnnNeuron, numGates: number): RnnSynapse {
        return new RnnSynapse(source, target, numGates);
    }

    /** Factory for hidden-to-output Synapse (single-weight edge). */
    protected _createOutputSynapse(source: IRnnNeuron, target: MlpNeuron, weight: number): Synapse {
        return new Synapse(source, target, weight);
    }
}
