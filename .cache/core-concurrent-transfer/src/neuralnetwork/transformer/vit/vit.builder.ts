import { GraphBuilder } from "../../../graph";
import { WeightInit } from "../../nn.weights";
import { IVitConfig, IVitGraph, IVitNeuron, IVitSynapse, ITransformerBlockWeights, VitNeuronType } from "./vit.interfaces";
import { VitNeuron } from "./vit.neuron";
import { createLayerNorm } from "./vit.math";

/// <summary>
/// Builder for Vision Transformer (ViT) networks.
///
/// Unlike CNN/MLP builders which encode every connection as a synapse in the graph,
/// the ViT builder stores transformer weight matrices as metadata on the graph.
/// This avoids a combinatorial explosion of synapses (O(numTokens^2 * embedDim))
/// that would crash the graph builder.
///
/// The graph contains only lightweight neuron placeholders for:
///   - Input neurons (for API compatibility)
///   - Output neurons (for API compatibility)
///
/// All computation happens in the runtime using the weight matrices.
///
/// Usage:
///   const graph = new VitBuilder()
///       .withConfig(VitPresets.tiny)
///       .build();
/// </summary>
export class VitBuilder {
    private _config: IVitConfig | null = null;

    public withConfig(config: IVitConfig): VitBuilder {
        this._config = { ...config };
        return this;
    }

    public withWidth(w: number): VitBuilder {
        this._ensureConfig();
        this._config!.width = w;
        return this;
    }
    public withHeight(h: number): VitBuilder {
        this._ensureConfig();
        this._config!.height = h;
        return this;
    }
    public withChannels(c: number): VitBuilder {
        this._ensureConfig();
        this._config!.channels = c;
        return this;
    }
    public withPatchSize(p: number): VitBuilder {
        this._ensureConfig();
        this._config!.patchSize = p;
        return this;
    }
    public withEmbedDim(d: number): VitBuilder {
        this._ensureConfig();
        this._config!.embedDim = d;
        return this;
    }
    public withNumHeads(h: number): VitBuilder {
        this._ensureConfig();
        this._config!.numHeads = h;
        return this;
    }
    public withNumBlocks(b: number): VitBuilder {
        this._ensureConfig();
        this._config!.numBlocks = b;
        return this;
    }
    public withMlpRatio(r: number): VitBuilder {
        this._ensureConfig();
        this._config!.mlpRatio = r;
        return this;
    }
    public withNumClasses(c: number): VitBuilder {
        this._ensureConfig();
        this._config!.numClasses = c;
        return this;
    }

    /// <summary>
    /// Builds the complete ViT graph with weight matrices.
    /// </summary>
    public build(): IVitGraph {
        const c = this._config;
        if (!c) throw new Error("VitBuilder: config is required");
        if (c.width % c.patchSize !== 0) throw new Error(`Width ${c.width} not divisible by patchSize ${c.patchSize}`);
        if (c.height % c.patchSize !== 0) throw new Error(`Height ${c.height} not divisible by patchSize ${c.patchSize}`);
        if (c.embedDim % c.numHeads !== 0) throw new Error(`embedDim ${c.embedDim} not divisible by numHeads ${c.numHeads}`);

        const patchesX = c.width / c.patchSize;
        const patchesY = c.height / c.patchSize;
        const numPatches = patchesX * patchesY;
        const patchPixels = c.patchSize * c.patchSize * c.channels;
        const mlpDim = c.embedDim * c.mlpRatio;

        // =====================================================================
        // 1. Create lightweight neurons (for graph API compatibility)
        // =====================================================================
        const inputNeurons: VitNeuron[] = [];
        for (let i = 0; i < c.width * c.height * c.channels; i++) {
            inputNeurons.push(this._createInputNeuron());
        }

        const outputNeurons: VitNeuron[] = [];
        for (let i = 0; i < c.numClasses; i++) {
            outputNeurons.push(this._createOutputNeuron(i));
        }

        const allNeurons: IVitNeuron[] = [...inputNeurons, ...outputNeurons];

        // =====================================================================
        // 2. Initialize weight matrices
        // =====================================================================

        // Patch embedding: [patchPixels, embedDim]
        const patchEmbedWeights = new Array(patchPixels * c.embedDim);
        for (let i = 0; i < patchEmbedWeights.length; i++) {
            patchEmbedWeights[i] = WeightInit.Glorot(patchPixels, c.embedDim);
        }
        const patchEmbedBias = new Array(c.embedDim).fill(0);

        // Class token
        const classTokenValues = new Array(c.embedDim);
        for (let i = 0; i < c.embedDim; i++) {
            classTokenValues[i] = WeightInit.Normal(0, 0.02);
        }

        // Positional embeddings: [numPatches+1, embedDim]
        const positionalEmbeddings: number[][] = [];
        for (let t = 0; t < numPatches + 1; t++) {
            const posEmb = new Array(c.embedDim);
            for (let e = 0; e < c.embedDim; e++) {
                posEmb[e] = WeightInit.Normal(0, 0.02);
            }
            positionalEmbeddings.push(posEmb);
        }

        // Transformer blocks
        const blockWeights: ITransformerBlockWeights[] = [];
        const layerNorms = [];

        for (let block = 0; block < c.numBlocks; block++) {
            // LayerNorm 1 (pre-attention) and LayerNorm 2 (pre-MLP)
            layerNorms.push(createLayerNorm(c.embedDim));
            layerNorms.push(createLayerNorm(c.embedDim));

            // QKV weights: [3, embedDim, embedDim] (Q, K, V each project embedDim -> embedDim)
            const qkvWeights = new Array(3 * c.embedDim * c.embedDim);
            for (let i = 0; i < qkvWeights.length; i++) {
                qkvWeights[i] = WeightInit.Glorot(c.embedDim, c.embedDim);
            }
            const qkvBias = new Array(3 * c.embedDim).fill(0);

            // Output projection: [embedDim, embedDim]
            const projWeights = new Array(c.embedDim * c.embedDim);
            for (let i = 0; i < projWeights.length; i++) {
                projWeights[i] = WeightInit.Glorot(c.embedDim, c.embedDim);
            }
            const projBias = new Array(c.embedDim).fill(0);

            // MLP layer 1: [embedDim, mlpDim]
            const mlp1Weights = new Array(c.embedDim * mlpDim);
            for (let i = 0; i < mlp1Weights.length; i++) {
                mlp1Weights[i] = WeightInit.Glorot(c.embedDim, mlpDim);
            }
            const mlp1Bias = new Array(mlpDim).fill(0);

            // MLP layer 2: [mlpDim, embedDim]
            const mlp2Weights = new Array(mlpDim * c.embedDim);
            for (let i = 0; i < mlp2Weights.length; i++) {
                mlp2Weights[i] = WeightInit.Glorot(mlpDim, c.embedDim);
            }
            const mlp2Bias = new Array(c.embedDim).fill(0);

            blockWeights.push({
                qkvWeights,
                qkvBias,
                projWeights,
                projBias,
                mlp1Weights,
                mlp1Bias,
                mlp2Weights,
                mlp2Bias,
            });
        }

        // Classification head: [embedDim, numClasses]
        const headWeights = new Array(c.embedDim * c.numClasses);
        for (let i = 0; i < headWeights.length; i++) {
            headWeights[i] = WeightInit.Glorot(c.embedDim, c.numClasses);
        }
        const headBias = new Array(c.numClasses).fill(0);

        // =====================================================================
        // 3. Assemble graph
        // =====================================================================
        const builder = new GraphBuilder<IVitNeuron, IVitSynapse>();
        builder.withNodes(...allNeurons);

        const graph = builder.build() as unknown as IVitGraph;
        (graph as any).inputs = inputNeurons;
        (graph as any).outputs = outputNeurons;
        (graph as any).hiddens = [];

        // Attach ViT metadata
        (graph as any).numPatches = numPatches;
        (graph as any).embedDim = c.embedDim;
        (graph as any).numHeads = c.numHeads;
        (graph as any).numBlocks = c.numBlocks;
        (graph as any).patchSize = c.patchSize;
        (graph as any).numClasses = c.numClasses;
        (graph as any).mlpRatio = c.mlpRatio;
        (graph as any).layerNorms = layerNorms;
        (graph as any).positionalEmbeddings = positionalEmbeddings;
        (graph as any).blockWeights = blockWeights;
        (graph as any).patchEmbedWeights = patchEmbedWeights;
        (graph as any).patchEmbedBias = patchEmbedBias;
        (graph as any).classTokenValues = classTokenValues;
        (graph as any).headWeights = headWeights;
        (graph as any).headBias = headBias;

        // Per-patch decoder (MAE-style autoencoder)
        // Each patch token (embedDim) -> reconstructs its own patch (patchPixels)
        const patchDecoderWeights = new Array(c.embedDim * patchPixels);
        for (let i = 0; i < patchDecoderWeights.length; i++) {
            patchDecoderWeights[i] = WeightInit.Glorot(c.embedDim, patchPixels);
        }
        const patchDecoderBias = new Array(patchPixels).fill(0);
        (graph as any).patchDecoderWeights = patchDecoderWeights;
        (graph as any).patchDecoderBias = patchDecoderBias;

        return graph;
    }

    public reset(): VitBuilder {
        this._config = null;
        return this;
    }

    // ── Concrete-class factories (override in subclasses) ─────────────────

    /** Factory for ViT input-tile neurons. */
    protected _createInputNeuron(): VitNeuron {
        return new VitNeuron(VitNeuronType.Input);
    }

    /** Factory for ViT output (classification head) neurons. */
    protected _createOutputNeuron(index: number): VitNeuron {
        return new VitNeuron(VitNeuronType.Output, 0, index);
    }

    private _ensureConfig(): void {
        if (!this._config) {
            this._config = {
                width: 28,
                height: 28,
                channels: 1,
                patchSize: 7,
                embedDim: 64,
                numHeads: 4,
                numBlocks: 2,
                mlpRatio: 2,
                numClasses: 10,
            };
        }
    }
}
