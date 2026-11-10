import { ISatGraph } from "./sat.interfaces";
import { SatInferenceRuntime } from "./sat.inference";
import { softmaxBackward, geluDerivative, layerNormBackward } from "../vit/vit.math";
import { ILossFunction } from "../../nn.training";

/// <summary>
/// Training runtime for Spatial Attention Transformer.
/// Backpropagation follows the sparse attention pattern defined by neighborMaps.
/// </summary>
export class SatTrainingRuntime {
    private _graph: ISatGraph;
    private _runtime: SatInferenceRuntime;
    private _learningRate: number;

    constructor(graph: ISatGraph, runtime: SatInferenceRuntime, _lossFn: ILossFunction, learningRate: number) {
        this._graph = graph;
        this._runtime = runtime;
        this._learningRate = learningRate;
        void _lossFn; // reserved for future use (currently MSE hardcoded in trainStepMAE)
    }

    public get learningRate(): number {
        return this._learningRate;
    }
    public set learningRate(lr: number) {
        this._learningRate = lr;
    }

    /// <summary>
    /// MAE-style training step with spatial attention.
    /// Each patch token reconstructs its own patch pixels.
    /// </summary>
    public trainStepMAE(inputPixels: number[]): number {
        const g = this._graph;
        const lr = this._learningRate;
        const embedDim = g.embedDim;
        const patchSize = g.patchSize;
        const imgChannels = Math.round(inputPixels.length / (g.numPatches * patchSize * patchSize));
        const imgWidth = Math.round(Math.sqrt(inputPixels.length / imgChannels));
        const patchesX = imgWidth / patchSize;
        const patchPixels = patchSize * patchSize * imgChannels;
        const numTokens = g.numPatches + 1;
        const numHeads = g.numHeads;
        const headDim = embedDim / numHeads;
        const mlpDim = embedDim * g.mlpRatio;

        // Forward pass
        this._runtime.run(inputPixels);

        // Per-patch reconstruction + gradients
        let totalLoss = 0;
        const dTokens: number[][] = new Array(numTokens).fill(null).map(() => new Array(embedDim).fill(0));

        for (let p = 0; p < g.numPatches; p++) {
            const token = this._runtime.tokens[p + 1];
            const patchRow = Math.floor(p / patchesX);
            const patchCol = p % patchesX;

            for (let px = 0; px < patchPixels; px++) {
                let sum = g.patchDecoderBias![px];
                for (let e = 0; e < embedDim; e++) {
                    sum += token[e] * g.patchDecoderWeights![e * patchPixels + px];
                }
                const output = 1 / (1 + Math.exp(-sum));

                const ch = px % imgChannels;
                const spatialIdx = Math.floor(px / imgChannels);
                const localY = Math.floor(spatialIdx / patchSize);
                const localX = spatialIdx % patchSize;
                const imgY = patchRow * patchSize + localY;
                const imgX = patchCol * patchSize + localX;
                const flatIdx = (imgY * imgWidth + imgX) * imgChannels + ch;
                const target = inputPixels[flatIdx];

                totalLoss += (output - target) * (output - target);

                const dLogit = (output - target) * output * (1 - output);

                g.patchDecoderBias![px] -= lr * dLogit;
                for (let e = 0; e < embedDim; e++) {
                    const wIdx = e * patchPixels + px;
                    dTokens[p + 1][e] += dLogit * g.patchDecoderWeights![wIdx];
                    g.patchDecoderWeights![wIdx] -= lr * dLogit * token[e];
                }
            }
        }

        // =====================================================================
        // Backprop through transformer blocks with SPARSE attention gradients
        // =====================================================================
        for (let block = g.numBlocks - 1; block >= 0; block--) {
            const bw = g.blockWeights[block];
            const lnIdx = block * 2;
            const neighbors = g.neighborMaps[block];

            // MLP residual
            const dMlpOut = dTokens.map((t) => [...t]);

            // MLP2 backward
            const mlpCache = this._runtime.mlpCache[block];
            const dMlpHidden: number[][] = new Array(numTokens).fill(null).map(() => new Array(mlpDim).fill(0));

            for (let t = 0; t < numTokens; t++) {
                for (let e = 0; e < embedDim; e++) {
                    for (let m = 0; m < mlpDim; m++) {
                        dMlpHidden[t][m] += dMlpOut[t][e] * bw.mlp2Weights[m * embedDim + e];
                    }
                }
            }
            for (let t = 0; t < numTokens; t++) {
                for (let e = 0; e < embedDim; e++) {
                    bw.mlp2Bias[e] -= lr * dMlpOut[t][e];
                    for (let m = 0; m < mlpDim; m++) {
                        bw.mlp2Weights[m * embedDim + e] -= lr * dMlpOut[t][e] * mlpCache.hidden[t][m];
                    }
                }
            }

            // GELU backward
            const dMlpPreGelu: number[][] = [];
            for (let t = 0; t < numTokens; t++) {
                const d = new Array(mlpDim);
                for (let m = 0; m < mlpDim; m++) {
                    d[m] = dMlpHidden[t][m] * geluDerivative(mlpCache.preGelu[t][m]);
                }
                dMlpPreGelu.push(d);
            }

            // MLP1 backward
            const ln2Cache = this._runtime.layerNormCache[lnIdx + 1];
            const dPreLN2: number[][] = new Array(numTokens).fill(null).map(() => new Array(embedDim).fill(0));
            const ln2Out: number[][] = [];
            for (let t = 0; t < numTokens; t++) {
                const out = new Array(embedDim);
                for (let e = 0; e < embedDim; e++) {
                    out[e] = g.layerNorms[lnIdx + 1].gamma[e] * ln2Cache.normalized[t][e] + g.layerNorms[lnIdx + 1].beta[e];
                }
                ln2Out.push(out);
            }

            for (let t = 0; t < numTokens; t++) {
                for (let m = 0; m < mlpDim; m++) {
                    for (let e = 0; e < embedDim; e++) {
                        dPreLN2[t][e] += dMlpPreGelu[t][m] * bw.mlp1Weights[e * mlpDim + m];
                    }
                }
            }
            for (let t = 0; t < numTokens; t++) {
                for (let m = 0; m < mlpDim; m++) {
                    bw.mlp1Bias[m] -= lr * dMlpPreGelu[t][m];
                    for (let e = 0; e < embedDim; e++) {
                        bw.mlp1Weights[e * mlpDim + m] -= lr * dMlpPreGelu[t][m] * ln2Out[t][e];
                    }
                }
            }

            // LayerNorm 2 backward
            const ln2 = g.layerNorms[lnIdx + 1];
            for (let t = 0; t < numTokens; t++) {
                const lnResult = layerNormBackward(dPreLN2[t], ln2Cache.normalized[t], ln2Cache.invStd[t], ln2);
                for (let e = 0; e < embedDim; e++) {
                    dTokens[t][e] = dMlpOut[t][e] + lnResult.dInput[e];
                }
                for (let e = 0; e < embedDim; e++) {
                    ln2.gamma[e] -= lr * lnResult.dGamma[e];
                    ln2.beta[e] -= lr * lnResult.dBeta[e];
                }
            }

            // Attention residual
            const dAttnOut = dTokens.map((t) => [...t]);

            // Projection backward
            const attnCache = this._runtime.attentionCache[block];
            const dAttnConcat: number[][] = new Array(numTokens).fill(null).map(() => new Array(embedDim).fill(0));

            for (let t = 0; t < numTokens; t++) {
                for (let e = 0; e < embedDim; e++) {
                    for (let s = 0; s < embedDim; s++) {
                        dAttnConcat[t][s] += dAttnOut[t][e] * bw.projWeights[s * embedDim + e];
                    }
                }
            }
            for (let t = 0; t < numTokens; t++) {
                for (let e = 0; e < embedDim; e++) {
                    bw.projBias[e] -= lr * dAttnOut[t][e];
                    for (let s = 0; s < embedDim; s++) {
                        bw.projWeights[s * embedDim + e] -= lr * dAttnOut[t][e] * attnCache.attnOut[t][s];
                    }
                }
            }

            // *** SPARSE ATTENTION BACKWARD ***
            const dQ: number[][] = new Array(numTokens).fill(null).map(() => new Array(embedDim).fill(0));
            const dK: number[][] = new Array(numTokens).fill(null).map(() => new Array(embedDim).fill(0));
            const dV: number[][] = new Array(numTokens).fill(null).map(() => new Array(embedDim).fill(0));

            for (let h = 0; h < numHeads; h++) {
                const offset = h * headDim;
                const scale = Math.sqrt(headDim);
                const headScores = attnCache.scores[h];

                for (let tq = 0; tq < numTokens; tq++) {
                    const tokenNeighbors = neighbors[tq];
                    const numNeighbors = tokenNeighbors.length;
                    const scores = headScores[tq];

                    // dScores, dV from attention output (sparse)
                    const dScores = new Array(numNeighbors).fill(0);

                    for (let d = 0; d < headDim; d++) {
                        for (let ni = 0; ni < numNeighbors; ni++) {
                            const tk = tokenNeighbors[ni];
                            dScores[ni] += dAttnConcat[tq][offset + d] * attnCache.V[tk][offset + d];
                            dV[tk][offset + d] += dAttnConcat[tq][offset + d] * scores[ni];
                        }
                    }

                    // Softmax backward (sparse)
                    const dLogits = softmaxBackward(scores, dScores);

                    for (let ni = 0; ni < numNeighbors; ni++) {
                        const tk = tokenNeighbors[ni];
                        for (let d = 0; d < headDim; d++) {
                            dQ[tq][offset + d] += (dLogits[ni] * attnCache.K[tk][offset + d]) / scale;
                            dK[tk][offset + d] += (dLogits[ni] * attnCache.Q[tq][offset + d]) / scale;
                        }
                    }
                }
            }

            // Update QKV weights
            const ln1Cache = this._runtime.layerNormCache[lnIdx];
            for (let t = 0; t < numTokens; t++) {
                for (let e = 0; e < embedDim; e++) {
                    bw.qkvBias[0 * embedDim + e] -= lr * dQ[t][e];
                    bw.qkvBias[1 * embedDim + e] -= lr * dK[t][e];
                    bw.qkvBias[2 * embedDim + e] -= lr * dV[t][e];
                    for (let s = 0; s < embedDim; s++) {
                        const lnVal = ln1Cache.normalized[t][s] * g.layerNorms[lnIdx].gamma[s];
                        bw.qkvWeights[0 * embedDim * embedDim + s * embedDim + e] -= lr * dQ[t][e] * lnVal;
                        bw.qkvWeights[1 * embedDim * embedDim + s * embedDim + e] -= lr * dK[t][e] * lnVal;
                        bw.qkvWeights[2 * embedDim * embedDim + s * embedDim + e] -= lr * dV[t][e] * lnVal;
                    }
                }
            }

            // LayerNorm 1 backward
            const dPreLN1: number[][] = new Array(numTokens).fill(null).map(() => new Array(embedDim).fill(0));
            for (let t = 0; t < numTokens; t++) {
                for (let e = 0; e < embedDim; e++) {
                    for (let s = 0; s < embedDim; s++) {
                        dPreLN1[t][s] += dQ[t][e] * bw.qkvWeights[0 * embedDim * embedDim + s * embedDim + e];
                        dPreLN1[t][s] += dK[t][e] * bw.qkvWeights[1 * embedDim * embedDim + s * embedDim + e];
                        dPreLN1[t][s] += dV[t][e] * bw.qkvWeights[2 * embedDim * embedDim + s * embedDim + e];
                    }
                }
            }

            const ln1 = g.layerNorms[lnIdx];
            for (let t = 0; t < numTokens; t++) {
                const lnResult = layerNormBackward(dPreLN1[t], ln1Cache.normalized[t], ln1Cache.invStd[t], ln1);
                for (let e = 0; e < embedDim; e++) {
                    dTokens[t][e] = dAttnOut[t][e] + lnResult.dInput[e];
                }
                for (let e = 0; e < embedDim; e++) {
                    ln1.gamma[e] -= lr * lnResult.dGamma[e];
                    ln1.beta[e] -= lr * lnResult.dBeta[e];
                }
            }
        }

        // Positional embeddings + class token + patch embedding
        for (let t = 0; t < numTokens; t++) {
            for (let e = 0; e < embedDim; e++) {
                g.positionalEmbeddings[t][e] -= lr * dTokens[t][e];
            }
        }
        for (let e = 0; e < embedDim; e++) {
            g.classTokenValues[e] -= lr * dTokens[0][e];
        }

        for (let p = 0; p < g.numPatches; p++) {
            const t = p + 1;
            const patchRow = Math.floor(p / patchesX);
            const patchCol = p % patchesX;
            for (let e = 0; e < embedDim; e++) {
                g.patchEmbedBias[e] -= lr * dTokens[t][e];
                let pixIdx = 0;
                for (let py = 0; py < patchSize; py++) {
                    for (let px = 0; px < patchSize; px++) {
                        for (let ch = 0; ch < imgChannels; ch++) {
                            const imgY = patchRow * patchSize + py;
                            const imgX = patchCol * patchSize + px;
                            const flatIdx = (imgY * imgWidth + imgX) * imgChannels + ch;
                            g.patchEmbedWeights[pixIdx * embedDim + e] -= lr * dTokens[t][e] * inputPixels[flatIdx];
                            pixIdx++;
                        }
                    }
                }
            }
        }

        return totalLoss / (g.numPatches * patchPixels);
    }
}
