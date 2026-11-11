import { GraphBuilder } from "../../../graph";
import { WeightInit } from "../../nn.weights";
import { IVitNeuron, IVitSynapse, VitNeuronType } from "../vit/vit.interfaces";
import { VitNeuron } from "../vit/vit.neuron";
import { createLayerNorm } from "../vit/vit.math";
import { ISatConfig, ISatGraph } from "./sat.interfaces";

/// <summary>
/// Builder for Spatial Attention Transformer (SAT).
///
/// Same structure as VitBuilder but adds pre-computed neighbor maps
/// that restrict attention to spatially proximate patches.
///
/// The neighbor map is computed from patch grid positions using
/// Chebyshev distance. Each block can have a different radius:
///   - R=1: 3x3 neighborhood (8 neighbors + self)
///   - R=2: 5x5 neighborhood (24 neighbors + self)
///   - R=Infinity: all patches (= standard ViT)
///
/// Class token (index 0) always attends to all tokens regardless of radius.
/// </summary>
export class SatBuilder {
    private _config: ISatConfig | null = null;

    public withConfig(config: ISatConfig): SatBuilder {
        this._config = { ...config };
        return this;
    }

    public build(): ISatGraph {
        const c = this._config;
        if (!c) throw new Error("SatBuilder: config is required");
        if (c.width % c.patchSize !== 0) throw new Error(`Width ${c.width} not divisible by patchSize ${c.patchSize}`);
        if (c.height % c.patchSize !== 0) throw new Error(`Height ${c.height} not divisible by patchSize ${c.patchSize}`);
        if (c.embedDim % c.numHeads !== 0) throw new Error(`embedDim ${c.embedDim} not divisible by numHeads ${c.numHeads}`);

        const patchesX = c.width / c.patchSize;
        const patchesY = c.height / c.patchSize;
        const numPatches = patchesX * patchesY;
        const patchPixels = c.patchSize * c.patchSize * c.channels;
        const mlpDim = c.embedDim * c.mlpRatio;

        // Resolve radius per block
        const radiusPerBlock: number[] = [];
        if (typeof c.radius === "number") {
            for (let i = 0; i < c.numBlocks; i++) radiusPerBlock.push(c.radius);
        } else {
            for (let i = 0; i < c.numBlocks; i++) {
                radiusPerBlock.push(c.radius[i] ?? Infinity);
            }
        }

        // =====================================================================
        // 1. Compute neighbor maps
        // =====================================================================
        // Patch positions in grid coordinates
        const patchPositions: Array<{ row: number; col: number }> = [];
        for (let p = 0; p < numPatches; p++) {
            patchPositions.push({
                row: Math.floor(p / patchesX),
                col: p % patchesX,
            });
        }

        const neighborMaps: number[][][] = [];
        const attentionPairsPerBlock: number[] = [];

        for (let block = 0; block < c.numBlocks; block++) {
            const R = radiusPerBlock[block];
            const blockNeighbors: number[][] = [];

            // Token 0 = class token: attends to ALL tokens (including self)
            const classTokenNeighbors: number[] = [];
            for (let t = 0; t < numPatches + 1; t++) classTokenNeighbors.push(t);
            blockNeighbors.push(classTokenNeighbors);

            let totalPairs = classTokenNeighbors.length;

            // Patch tokens: attend to neighbors within radius + class token
            for (let p = 0; p < numPatches; p++) {
                const neighbors: number[] = [0]; // always include class token
                const pos = patchPositions[p];

                for (let q = 0; q < numPatches; q++) {
                    const qPos = patchPositions[q];
                    const dist = Math.max(Math.abs(pos.row - qPos.row), Math.abs(pos.col - qPos.col));
                    if (dist <= R) {
                        neighbors.push(q + 1); // +1 because token 0 is class token
                    }
                }

                blockNeighbors.push(neighbors);
                totalPairs += neighbors.length;
            }

            neighborMaps.push(blockNeighbors);
            attentionPairsPerBlock.push(totalPairs);
        }

        // =====================================================================
        // 2. Create neurons (lightweight, for API compatibility)
        // =====================================================================
        const inputNeurons: VitNeuron[] = [];
        for (let i = 0; i < c.width * c.height * c.channels; i++) {
            inputNeurons.push(this._createInputNeuron());
        }

        const outputNeurons: VitNeuron[] = [];
        const numOutputs = c.patchDecode ? 0 : c.numClasses || 10;
        for (let i = 0; i < numOutputs; i++) {
            outputNeurons.push(this._createOutputNeuron(i));
        }

        const allNeurons: IVitNeuron[] = [...inputNeurons, ...outputNeurons];

        // =====================================================================
        // 3. Initialize weight matrices (same as VitBuilder)
        // =====================================================================
        const patchEmbedWeights = new Array(patchPixels * c.embedDim);
        for (let i = 0; i < patchEmbedWeights.length; i++) {
            patchEmbedWeights[i] = WeightInit.Glorot(patchPixels, c.embedDim);
        }
        const patchEmbedBias = new Array(c.embedDim).fill(0);

        const classTokenValues = new Array(c.embedDim);
        for (let i = 0; i < c.embedDim; i++) {
            classTokenValues[i] = WeightInit.Normal(0, 0.02);
        }

        const positionalEmbeddings: number[][] = [];
        for (let t = 0; t < numPatches + 1; t++) {
            const posEmb = new Array(c.embedDim);
            for (let e = 0; e < c.embedDim; e++) {
                posEmb[e] = WeightInit.Normal(0, 0.02);
            }
            positionalEmbeddings.push(posEmb);
        }

        const blockWeights = [];
        const layerNorms = [];

        for (let block = 0; block < c.numBlocks; block++) {
            layerNorms.push(createLayerNorm(c.embedDim));
            layerNorms.push(createLayerNorm(c.embedDim));

            const qkvWeights = new Array(3 * c.embedDim * c.embedDim);
            for (let i = 0; i < qkvWeights.length; i++) qkvWeights[i] = WeightInit.Glorot(c.embedDim, c.embedDim);
            const qkvBias = new Array(3 * c.embedDim).fill(0);

            const projWeights = new Array(c.embedDim * c.embedDim);
            for (let i = 0; i < projWeights.length; i++) projWeights[i] = WeightInit.Glorot(c.embedDim, c.embedDim);
            const projBias = new Array(c.embedDim).fill(0);

            const mlp1Weights = new Array(c.embedDim * mlpDim);
            for (let i = 0; i < mlp1Weights.length; i++) mlp1Weights[i] = WeightInit.Glorot(c.embedDim, mlpDim);
            const mlp1Bias = new Array(mlpDim).fill(0);

            const mlp2Weights = new Array(mlpDim * c.embedDim);
            for (let i = 0; i < mlp2Weights.length; i++) mlp2Weights[i] = WeightInit.Glorot(mlpDim, c.embedDim);
            const mlp2Bias = new Array(c.embedDim).fill(0);

            blockWeights.push({ qkvWeights, qkvBias, projWeights, projBias, mlp1Weights, mlp1Bias, mlp2Weights, mlp2Bias });
        }

        const headWeights = new Array(c.embedDim * numOutputs);
        for (let i = 0; i < headWeights.length; i++) headWeights[i] = WeightInit.Glorot(c.embedDim, numOutputs || 1);
        const headBias = new Array(numOutputs).fill(0);

        const patchDecoderWeights = new Array(c.embedDim * patchPixels);
        for (let i = 0; i < patchDecoderWeights.length; i++) patchDecoderWeights[i] = WeightInit.Glorot(c.embedDim, patchPixels);
        const patchDecoderBias = new Array(patchPixels).fill(0);

        // =====================================================================
        // 4. Assemble graph
        // =====================================================================
        const builder = new GraphBuilder<IVitNeuron, IVitSynapse>();
        builder.withNodes(...allNeurons);

        const graph = builder.build() as unknown as ISatGraph;
        (graph as any).inputs = inputNeurons;
        (graph as any).outputs = outputNeurons;
        (graph as any).hiddens = [];

        // ViT metadata
        (graph as any).numPatches = numPatches;
        (graph as any).embedDim = c.embedDim;
        (graph as any).numHeads = c.numHeads;
        (graph as any).numBlocks = c.numBlocks;
        (graph as any).patchSize = c.patchSize;
        (graph as any).numClasses = numOutputs;
        (graph as any).mlpRatio = c.mlpRatio;
        (graph as any).layerNorms = layerNorms;
        (graph as any).positionalEmbeddings = positionalEmbeddings;
        (graph as any).blockWeights = blockWeights;
        (graph as any).patchEmbedWeights = patchEmbedWeights;
        (graph as any).patchEmbedBias = patchEmbedBias;
        (graph as any).classTokenValues = classTokenValues;
        (graph as any).headWeights = headWeights;
        (graph as any).headBias = headBias;
        (graph as any).patchDecoderWeights = patchDecoderWeights;
        (graph as any).patchDecoderBias = patchDecoderBias;

        // SAT-specific metadata
        (graph as any).radiusPerBlock = radiusPerBlock;
        (graph as any).neighborMaps = neighborMaps;
        (graph as any).attentionPairsPerBlock = attentionPairsPerBlock;

        return graph;
    }

    public reset(): SatBuilder {
        this._config = null;
        return this;
    }

    // ── Concrete-class factories (override in subclasses) ─────────────────

    /** Factory for SAT input-tile neurons. */
    protected _createInputNeuron(): VitNeuron {
        return new VitNeuron(VitNeuronType.Input);
    }

    /** Factory for SAT output (classification head) neurons. */
    protected _createOutputNeuron(index: number): VitNeuron {
        return new VitNeuron(VitNeuronType.Output, 0, index);
    }
}
