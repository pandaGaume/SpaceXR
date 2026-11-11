import { IVitGraph } from "./vit.interfaces";
import { VitInferenceRuntime } from "./vit.inference";
import { softmaxBackward, geluDerivative, layerNormBackward } from "./vit.math";
import { IOptimizer, ILossFunction } from "../../nn.training";

/// <summary>
/// Training runtime for Vision Transformer graphs.
/// Backpropagation through weight matrices stored on the graph.
/// </summary>
export class VitTrainingRuntime {
    private _graph: IVitGraph;
    private _runtime: VitInferenceRuntime;
    private _lossFn: ILossFunction;
    private _learningRate: number;
    private _iteration: number = 0;

    constructor(
        graph: IVitGraph,
        runtime: VitInferenceRuntime,
        lossFn: ILossFunction,
        learningRate: number,
        _optimizer: IOptimizer // reserved for future use
    ) {
        this._graph = graph;
        this._runtime = runtime;
        this._lossFn = lossFn;
        this._learningRate = learningRate;
        void _optimizer;
    }

    public get learningRate(): number {
        return this._learningRate;
    }
    public set learningRate(lr: number) {
        this._learningRate = lr;
    }

    /// <summary>
    /// One training step: forward + backprop + weight update.
    /// </summary>
    public trainStep(inputPixels: number[], expected: number[]): number {
        const output = this._runtime.run(inputPixels);

        let totalLoss = 0;
        for (let i = 0; i < output.length; i++) {
            totalLoss += this._lossFn.loss(output[i], expected[i]);
        }

        this._backpropagate(output, expected, inputPixels);
        this._iteration++;
        return totalLoss;
    }

    /// <summary>
    /// MAE-style training step: each patch token reconstructs its own patch.
    /// Input = target pixels (autoencoder).
    /// Returns: average MSE per pixel.
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

        if (!g.patchDecoderWeights || !g.patchDecoderBias) {
            throw new Error("patchDecoderWeights not initialized");
        }

        // Forward pass through encoder
        this._runtime.run(inputPixels);

        // Per-patch reconstruction + loss + gradient
        let totalLoss = 0;
        const dTokens: number[][] = new Array(numTokens).fill(null).map(() => new Array(embedDim).fill(0));

        for (let p = 0; p < g.numPatches; p++) {
            const token = this._runtime.tokens[p + 1];
            const patchRow = Math.floor(p / patchesX);
            const patchCol = p % patchesX;

            // Forward: token -> patch pixels (sigmoid)
            const patchOutput = new Array(patchPixels);
            const patchLogits = new Array(patchPixels);
            const patchTarget = new Array(patchPixels);

            for (let px = 0; px < patchPixels; px++) {
                let sum = g.patchDecoderBias[px];
                for (let e = 0; e < embedDim; e++) {
                    sum += token[e] * g.patchDecoderWeights[e * patchPixels + px];
                }
                patchLogits[px] = sum;
                patchOutput[px] = 1 / (1 + Math.exp(-sum)); // sigmoid

                // Get target pixel
                const ch = px % imgChannels;
                const spatialIdx = Math.floor(px / imgChannels);
                const localY = Math.floor(spatialIdx / patchSize);
                const localX = spatialIdx % patchSize;
                const imgY = patchRow * patchSize + localY;
                const imgX = patchCol * patchSize + localX;
                const flatIdx = (imgY * imgWidth + imgX) * imgChannels + ch;
                patchTarget[px] = inputPixels[flatIdx];
            }

            // MSE loss for this patch
            let patchLoss = 0;
            for (let px = 0; px < patchPixels; px++) {
                const diff = patchOutput[px] - patchTarget[px];
                patchLoss += diff * diff;
            }
            totalLoss += patchLoss / patchPixels;

            // Gradient: dL/dlogit = (output - target) * sigmoid'(logit)
            // sigmoid'(logit) = output * (1 - output)
            for (let px = 0; px < patchPixels; px++) {
                const dLogit = (patchOutput[px] - patchTarget[px]) * patchOutput[px] * (1 - patchOutput[px]);

                // Update decoder weights
                g.patchDecoderBias[px] -= lr * dLogit;
                for (let e = 0; e < embedDim; e++) {
                    const wIdx = e * patchPixels + px;
                    dTokens[p + 1][e] += dLogit * g.patchDecoderWeights[wIdx];
                    g.patchDecoderWeights[wIdx] -= lr * dLogit * token[e];
                }
            }
        }

        // Backprop through transformer blocks using dTokens
        this._backpropTokens(dTokens, inputPixels);

        this._iteration++;
        return totalLoss / g.numPatches;
    }

    /// <summary>
    /// Backprop through transformer blocks given token gradients.
    /// Shared between classification and MAE modes.
    /// </summary>
    private _backpropTokens(dTokens: number[][], inputPixels: number[]): void {
        const g = this._graph;
        const lr = this._learningRate;
        const embedDim = g.embedDim;
        const numTokens = g.numPatches + 1;
        const numHeads = g.numHeads;
        const headDim = embedDim / numHeads;
        const mlpDim = embedDim * g.mlpRatio;

        for (let block = g.numBlocks - 1; block >= 0; block--) {
            const bw = g.blockWeights[block];
            const lnIdx = block * 2;

            // MLP residual
            const dMlpOut = dTokens.map((t) => [...t]);

            // Backprop MLP output layer
            const mlpCache = this._runtime.mlpCache[block];
            const dMlpHidden: number[][] = new Array(numTokens).fill(null).map(() => new Array(mlpDim).fill(0));

            for (let t = 0; t < numTokens; t++) {
                for (let e = 0; e < embedDim; e++) {
                    for (let m = 0; m < mlpDim; m++) {
                        const wIdx = m * embedDim + e;
                        dMlpHidden[t][m] += dMlpOut[t][e] * bw.mlp2Weights[wIdx];
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

            // MLP hidden layer backward
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

            // Attention QKV backward
            const dQ: number[][] = new Array(numTokens).fill(null).map(() => new Array(embedDim).fill(0));
            const dK: number[][] = new Array(numTokens).fill(null).map(() => new Array(embedDim).fill(0));
            const dV: number[][] = new Array(numTokens).fill(null).map(() => new Array(embedDim).fill(0));

            for (let h = 0; h < numHeads; h++) {
                const offset = h * headDim;
                const scale = Math.sqrt(headDim);
                const scores = attnCache.scores[h];

                const dScores: number[][] = new Array(numTokens).fill(null).map(() => new Array(numTokens).fill(0));

                for (let tq = 0; tq < numTokens; tq++) {
                    for (let d = 0; d < headDim; d++) {
                        for (let tk = 0; tk < numTokens; tk++) {
                            dScores[tq][tk] += dAttnConcat[tq][offset + d] * attnCache.V[tk][offset + d];
                            dV[tk][offset + d] += dAttnConcat[tq][offset + d] * scores[tq][tk];
                        }
                    }
                }

                for (let tq = 0; tq < numTokens; tq++) {
                    const dLogits = softmaxBackward(scores[tq], dScores[tq]);
                    for (let tk = 0; tk < numTokens; tk++) {
                        for (let d = 0; d < headDim; d++) {
                            dQ[tq][offset + d] += (dLogits[tk] * attnCache.K[tk][offset + d]) / scale;
                            dK[tk][offset + d] += (dLogits[tk] * attnCache.Q[tq][offset + d]) / scale;
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

        // Positional embeddings
        for (let t = 0; t < numTokens; t++) {
            for (let e = 0; e < embedDim; e++) {
                g.positionalEmbeddings[t][e] -= lr * dTokens[t][e];
            }
        }

        // Class token
        for (let e = 0; e < embedDim; e++) {
            g.classTokenValues[e] -= lr * dTokens[0][e];
        }

        // Patch embedding
        const patchSize = g.patchSize;
        const imgChannels = Math.round(inputPixels.length / (g.numPatches * patchSize * patchSize));
        const imgWidth2 = Math.round(Math.sqrt(inputPixels.length / imgChannels));
        const patchesX = imgWidth2 / patchSize;

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
                            const flatIdx = (imgY * imgWidth2 + imgX) * imgChannels + ch;
                            g.patchEmbedWeights[pixIdx * embedDim + e] -= lr * dTokens[t][e] * inputPixels[flatIdx];
                            pixIdx++;
                        }
                    }
                }
            }
        }
    }

    private _backpropagate(output: number[], expected: number[], inputPixels: number[]): void {
        const g = this._graph;
        const lr = this._learningRate;
        const embedDim = g.embedDim;
        const numTokens = g.numPatches + 1;
        const numHeads = g.numHeads;
        const headDim = embedDim / numHeads;
        const mlpDim = embedDim * g.mlpRatio;

        // =====================================================================
        // 1. Classification head gradient
        // =====================================================================
        const dLogits = new Array(g.numClasses);
        if (this._runtime.useSoftmax) {
            // softmax + cross-entropy: dL/dlogit = output - expected
            for (let i = 0; i < g.numClasses; i++) {
                dLogits[i] = output[i] - expected[i];
            }
        } else {
            // sigmoid + MSE: dL/dlogit = (output - expected) * sigmoid'(logit)
            // sigmoid'(logit) = output * (1 - output)
            for (let i = 0; i < g.numClasses; i++) {
                dLogits[i] = (output[i] - expected[i]) * output[i] * (1 - output[i]);
            }
        }

        // Gradient for head weights and class token
        const classToken = this._runtime.tokens[0];
        const dClassToken = new Array(embedDim).fill(0);

        // Compute class token gradient first
        for (let cls = 0; cls < g.numClasses; cls++) {
            for (let e = 0; e < embedDim; e++) {
                const wIdx = e * g.numClasses + cls;
                dClassToken[e] += dLogits[cls] * g.headWeights[wIdx];
            }
        }
        // Then update head weights
        for (let cls = 0; cls < g.numClasses; cls++) {
            g.headBias[cls] -= lr * dLogits[cls];
            for (let e = 0; e < embedDim; e++) {
                const wIdx = e * g.numClasses + cls;
                g.headWeights[wIdx] -= lr * dLogits[cls] * classToken[e];
            }
        }

        // Token gradients: [numTokens][embedDim]
        const dTokens: number[][] = new Array(numTokens).fill(null).map(() => new Array(embedDim).fill(0));
        for (let e = 0; e < embedDim; e++) {
            dTokens[0][e] = dClassToken[e];
        }

        // =====================================================================
        // 2. Backprop through transformer blocks (reverse)
        // =====================================================================
        for (let block = g.numBlocks - 1; block >= 0; block--) {
            const bw = g.blockWeights[block];
            const lnIdx = block * 2;

            // ----- Backprop through MLP residual -----
            // dTokens flows through both residual and MLP path
            const dMlpOut = dTokens.map((t) => [...t]);

            // ----- Backprop through MLP output layer -----
            const mlpCache = this._runtime.mlpCache[block];
            const dMlpHidden: number[][] = new Array(numTokens).fill(null).map(() => new Array(mlpDim).fill(0));

            // First compute gradients, then update weights
            for (let t = 0; t < numTokens; t++) {
                for (let e = 0; e < embedDim; e++) {
                    for (let m = 0; m < mlpDim; m++) {
                        const wIdx = m * embedDim + e;
                        dMlpHidden[t][m] += dMlpOut[t][e] * bw.mlp2Weights[wIdx];
                    }
                }
            }
            // Now update MLP2 weights
            for (let t = 0; t < numTokens; t++) {
                for (let e = 0; e < embedDim; e++) {
                    bw.mlp2Bias[e] -= lr * dMlpOut[t][e];
                    for (let m = 0; m < mlpDim; m++) {
                        const wIdx = m * embedDim + e;
                        bw.mlp2Weights[wIdx] -= lr * dMlpOut[t][e] * mlpCache.hidden[t][m];
                    }
                }
            }

            // ----- Backprop through GELU -----
            const dMlpPreGelu: number[][] = [];
            for (let t = 0; t < numTokens; t++) {
                const d = new Array(mlpDim);
                for (let m = 0; m < mlpDim; m++) {
                    d[m] = dMlpHidden[t][m] * geluDerivative(mlpCache.preGelu[t][m]);
                }
                dMlpPreGelu.push(d);
            }

            // ----- Backprop through MLP hidden layer -----
            // The input to MLP1 is the LN2 output = gamma * normalized + beta
            const ln2Cache = this._runtime.layerNormCache[lnIdx + 1];
            const dPreLN2: number[][] = new Array(numTokens).fill(null).map(() => new Array(embedDim).fill(0));

            // Reconstruct LN2 output (input to MLP1)
            const ln2Out: number[][] = [];
            for (let t = 0; t < numTokens; t++) {
                const out = new Array(embedDim);
                for (let e = 0; e < embedDim; e++) {
                    out[e] = g.layerNorms[lnIdx + 1].gamma[e] * ln2Cache.normalized[t][e] + g.layerNorms[lnIdx + 1].beta[e];
                }
                ln2Out.push(out);
            }

            // Compute gradient first
            for (let t = 0; t < numTokens; t++) {
                for (let m = 0; m < mlpDim; m++) {
                    for (let e = 0; e < embedDim; e++) {
                        const wIdx = e * mlpDim + m;
                        dPreLN2[t][e] += dMlpPreGelu[t][m] * bw.mlp1Weights[wIdx];
                    }
                }
            }
            // Then update MLP1 weights
            for (let t = 0; t < numTokens; t++) {
                for (let m = 0; m < mlpDim; m++) {
                    bw.mlp1Bias[m] -= lr * dMlpPreGelu[t][m];
                    for (let e = 0; e < embedDim; e++) {
                        const wIdx = e * mlpDim + m;
                        bw.mlp1Weights[wIdx] -= lr * dMlpPreGelu[t][m] * ln2Out[t][e];
                    }
                }
            }

            // ----- Backprop through LayerNorm 2 -----
            const ln2 = g.layerNorms[lnIdx + 1];
            for (let t = 0; t < numTokens; t++) {
                const lnResult = layerNormBackward(dPreLN2[t], ln2Cache.normalized[t], ln2Cache.invStd[t], ln2);
                for (let e = 0; e < embedDim; e++) {
                    // Residual: gradient from both paths
                    dTokens[t][e] = dMlpOut[t][e] + lnResult.dInput[e];
                }
                for (let e = 0; e < embedDim; e++) {
                    ln2.gamma[e] -= lr * lnResult.dGamma[e];
                    ln2.beta[e] -= lr * lnResult.dBeta[e];
                }
            }

            // ----- Backprop through attention residual -----
            const dAttnOut = dTokens.map((t) => [...t]);

            // ----- Backprop through output projection -----
            const attnCache = this._runtime.attentionCache[block];
            const dAttnConcat: number[][] = new Array(numTokens).fill(null).map(() => new Array(embedDim).fill(0));

            // Compute gradient first
            for (let t = 0; t < numTokens; t++) {
                for (let e = 0; e < embedDim; e++) {
                    for (let s = 0; s < embedDim; s++) {
                        const wIdx = s * embedDim + e;
                        dAttnConcat[t][s] += dAttnOut[t][e] * bw.projWeights[wIdx];
                    }
                }
            }
            // Then update projection weights
            for (let t = 0; t < numTokens; t++) {
                for (let e = 0; e < embedDim; e++) {
                    bw.projBias[e] -= lr * dAttnOut[t][e];
                    for (let s = 0; s < embedDim; s++) {
                        const wIdx = s * embedDim + e;
                        bw.projWeights[wIdx] -= lr * dAttnOut[t][e] * attnCache.attnOut[t][s];
                    }
                }
            }

            // ----- Backprop through attention heads -----
            const dQ: number[][] = new Array(numTokens).fill(null).map(() => new Array(embedDim).fill(0));
            const dK: number[][] = new Array(numTokens).fill(null).map(() => new Array(embedDim).fill(0));
            const dV: number[][] = new Array(numTokens).fill(null).map(() => new Array(embedDim).fill(0));

            for (let h = 0; h < numHeads; h++) {
                const offset = h * headDim;
                const scale = Math.sqrt(headDim);
                const scores = attnCache.scores[h];

                // dScores, dV from attention output
                const dScores: number[][] = new Array(numTokens).fill(null).map(() => new Array(numTokens).fill(0));

                for (let tq = 0; tq < numTokens; tq++) {
                    for (let d = 0; d < headDim; d++) {
                        for (let tk = 0; tk < numTokens; tk++) {
                            dScores[tq][tk] += dAttnConcat[tq][offset + d] * attnCache.V[tk][offset + d];
                            dV[tk][offset + d] += dAttnConcat[tq][offset + d] * scores[tq][tk];
                        }
                    }
                }

                // Backprop through softmax
                for (let tq = 0; tq < numTokens; tq++) {
                    const dLogits = softmaxBackward(scores[tq], dScores[tq]);
                    for (let tk = 0; tk < numTokens; tk++) {
                        for (let d = 0; d < headDim; d++) {
                            dQ[tq][offset + d] += (dLogits[tk] * attnCache.K[tk][offset + d]) / scale;
                            dK[tk][offset + d] += (dLogits[tk] * attnCache.Q[tq][offset + d]) / scale;
                        }
                    }
                }
            }

            // Update QKV weights
            const ln1Cache = this._runtime.layerNormCache[lnIdx];
            const preAttnNormed = ln1Cache.normalized; // This is the input to QKV after LN

            for (let t = 0; t < numTokens; t++) {
                for (let e = 0; e < embedDim; e++) {
                    bw.qkvBias[0 * embedDim + e] -= lr * dQ[t][e];
                    bw.qkvBias[1 * embedDim + e] -= lr * dK[t][e];
                    bw.qkvBias[2 * embedDim + e] -= lr * dV[t][e];
                    for (let s = 0; s < embedDim; s++) {
                        const lnVal = preAttnNormed[t][s] * g.layerNorms[lnIdx].gamma[s];
                        bw.qkvWeights[0 * embedDim * embedDim + s * embedDim + e] -= lr * dQ[t][e] * lnVal;
                        bw.qkvWeights[1 * embedDim * embedDim + s * embedDim + e] -= lr * dK[t][e] * lnVal;
                        bw.qkvWeights[2 * embedDim * embedDim + s * embedDim + e] -= lr * dV[t][e] * lnVal;
                    }
                }
            }

            // ----- Backprop through LayerNorm 1 -----
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

        // =====================================================================
        // 3. Backprop positional embeddings
        // =====================================================================
        for (let t = 0; t < numTokens; t++) {
            for (let e = 0; e < embedDim; e++) {
                g.positionalEmbeddings[t][e] -= lr * dTokens[t][e];
            }
        }

        // =====================================================================
        // 4. Backprop class token
        // =====================================================================
        for (let e = 0; e < embedDim; e++) {
            g.classTokenValues[e] -= lr * dTokens[0][e];
        }

        // =====================================================================
        // 5. Backprop patch embedding
        // =====================================================================
        const patchSize = g.patchSize;
        const imgChannels = Math.round(inputPixels.length / (g.numPatches * patchSize * patchSize));
        const imgWidth = Math.round(Math.sqrt(inputPixels.length / imgChannels));
        const patchesX = imgWidth / patchSize;

        for (let p = 0; p < g.numPatches; p++) {
            const t = p + 1; // token index (0 is class token)
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
                            const wIdx = pixIdx * embedDim + e;
                            g.patchEmbedWeights[wIdx] -= lr * dTokens[t][e] * inputPixels[flatIdx];
                            pixIdx++;
                        }
                    }
                }
            }
        }
    }
}
