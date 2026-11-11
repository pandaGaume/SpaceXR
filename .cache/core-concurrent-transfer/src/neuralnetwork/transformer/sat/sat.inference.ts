import { ISatGraph } from "./sat.interfaces";
import { softmax, gelu, layerNormForward } from "../vit/vit.math";
import { Profiler } from "../../nn.profiler";

/// <summary>
/// Inference runtime for Spatial Attention Transformer (SAT).
///
/// Identical to VitInferenceRuntime except that the attention computation
/// is restricted to spatially proximate tokens via the pre-computed
/// neighbor map. This reduces complexity from O(N^2) to O(N*k).
///
/// Class token (index 0) always attends to all tokens.
/// Patch tokens attend only to neighbors within the configured radius.
/// </summary>
export class SatInferenceRuntime {
    private _graph: ISatGraph;

    public tokens: number[][] = [];
    public attentionPairsComputed: number = 0;

    /// <summary>Profiler for performance instrumentation.</summary>
    public profiler: Profiler = new Profiler(false);

    // Caches for backprop
    public layerNormCache: Array<{ mean: number[]; invStd: number[]; normalized: number[][] }> = [];
    public attentionCache: Array<{
        Q: number[][];
        K: number[][];
        V: number[][];
        scores: number[][][]; // [head][queryToken][sparse neighbor scores]
        scoreIndices: number[][]; // [queryToken] -> neighbor indices for this block
        attnOut: number[][];
    }> = [];
    public mlpCache: Array<{ preGelu: number[][]; hidden: number[][] }> = [];
    public residualCache: Array<{ preAttn: number[][]; preMlp: number[][] }> = [];

    constructor(graph: ISatGraph) {
        this._graph = graph;
    }

    public run(inputPixels: number[]): number[] {
        const g = this._graph;
        const numTokens = g.numPatches + 1;
        const embedDim = g.embedDim;
        const numHeads = g.numHeads;
        const headDim = embedDim / numHeads;
        const patchSize = g.patchSize;
        const pr = this.profiler;

        this.layerNormCache = [];
        this.attentionCache = [];
        this.mlpCache = [];
        this.residualCache = [];
        this.attentionPairsComputed = 0;

        // =====================================================================
        // 1. Patch embedding (same as ViT)
        // =====================================================================
        pr.startPhase("patch_embedding");
        this.tokens = [];

        // Class token
        this.tokens.push([...g.classTokenValues]);

        // Patch tokens
        const imgChannels = Math.round(inputPixels.length / (g.numPatches * patchSize * patchSize));
        const imgWidth = Math.round(Math.sqrt(inputPixels.length / imgChannels));
        const patchesX = imgWidth / patchSize;

        for (let p = 0; p < g.numPatches; p++) {
            const patchRow = Math.floor(p / patchesX);
            const patchCol = p % patchesX;
            const tokenEmbed = new Array(embedDim);

            for (let e = 0; e < embedDim; e++) {
                let sum = g.patchEmbedBias[e];
                let pixIdx = 0;
                for (let py = 0; py < patchSize; py++) {
                    for (let px = 0; px < patchSize; px++) {
                        for (let ch = 0; ch < imgChannels; ch++) {
                            const imgY = patchRow * patchSize + py;
                            const imgX = patchCol * patchSize + px;
                            const flatIdx = (imgY * imgWidth + imgX) * imgChannels + ch;
                            sum += inputPixels[flatIdx] * g.patchEmbedWeights[pixIdx * embedDim + e];
                            pixIdx++;
                        }
                    }
                }
                tokenEmbed[e] = sum;
            }
            this.tokens.push(tokenEmbed);
        }

        // Positional embeddings
        const imgChannelsCount = Math.round(inputPixels.length / (g.numPatches * patchSize * patchSize));
        pr.addFlops("patch_embedding", g.numPatches * embedDim * patchSize * patchSize * imgChannelsCount * 2);
        pr.endPhase("patch_embedding");

        for (let t = 0; t < numTokens; t++) {
            for (let e = 0; e < embedDim; e++) {
                this.tokens[t][e] += g.positionalEmbeddings[t][e];
            }
        }

        // =====================================================================
        // 2. Transformer blocks with SPATIAL attention
        // =====================================================================
        for (let block = 0; block < g.numBlocks; block++) {
            const bw = g.blockWeights[block];
            const lnIdx = block * 2;
            const neighbors = g.neighborMaps[block];

            pr.startPhase("layernorm");
            const preAttn = this.tokens.map((t) => [...t]);

            // LayerNorm 1
            const ln1 = g.layerNorms[lnIdx];
            const ln1Cache = { mean: [] as number[], invStd: [] as number[], normalized: [] as number[][] };
            for (let t = 0; t < numTokens; t++) {
                const r = layerNormForward(this.tokens[t], ln1);
                this.tokens[t] = r.output;
                ln1Cache.mean.push(r.mean);
                ln1Cache.invStd.push(r.invStd);
                ln1Cache.normalized.push(r.normalized);
            }
            this.layerNormCache.push(ln1Cache);
            pr.addFlops("layernorm", numTokens * embedDim * 5);
            pr.endPhase("layernorm");

            // Compute Q, K, V for all tokens
            pr.startPhase("attention_qkv");
            const Q: number[][] = [];
            const K: number[][] = [];
            const V: number[][] = [];

            for (let t = 0; t < numTokens; t++) {
                const q = new Array(embedDim).fill(0);
                const k = new Array(embedDim).fill(0);
                const v = new Array(embedDim).fill(0);
                for (let e = 0; e < embedDim; e++) {
                    for (let s = 0; s < embedDim; s++) {
                        q[e] += this.tokens[t][s] * bw.qkvWeights[0 * embedDim * embedDim + s * embedDim + e];
                        k[e] += this.tokens[t][s] * bw.qkvWeights[1 * embedDim * embedDim + s * embedDim + e];
                        v[e] += this.tokens[t][s] * bw.qkvWeights[2 * embedDim * embedDim + s * embedDim + e];
                    }
                    q[e] += bw.qkvBias[0 * embedDim + e];
                    k[e] += bw.qkvBias[1 * embedDim + e];
                    v[e] += bw.qkvBias[2 * embedDim + e];
                }
                Q.push(q);
                K.push(k);
                V.push(v);
            }
            pr.addFlops("attention_qkv", 3 * numTokens * embedDim * embedDim * 2);
            pr.endPhase("attention_qkv");

            // *** SPATIAL ATTENTION: only attend to neighbors ***
            pr.startPhase("attention_scores");
            const allScores: number[][][] = [];
            const attnOut: number[][] = new Array(numTokens).fill(null).map(() => new Array(embedDim).fill(0));

            for (let h = 0; h < numHeads; h++) {
                const offset = h * headDim;
                const scale = Math.sqrt(headDim);
                const headScores: number[][] = [];

                for (let tq = 0; tq < numTokens; tq++) {
                    const tokenNeighbors = neighbors[tq]; // SPARSE: only these tokens
                    const numNeighbors = tokenNeighbors.length;

                    // Compute attention logits only for neighbors
                    const logits = new Array(numNeighbors);
                    for (let ni = 0; ni < numNeighbors; ni++) {
                        const tk = tokenNeighbors[ni];
                        let dot = 0;
                        for (let d = 0; d < headDim; d++) {
                            dot += Q[tq][offset + d] * K[tk][offset + d];
                        }
                        logits[ni] = dot / scale;
                    }

                    const scores = softmax(logits);
                    headScores.push(scores);
                    this.attentionPairsComputed += numNeighbors;

                    // Weighted sum of V (only neighbors)
                    for (let d = 0; d < headDim; d++) {
                        let val = 0;
                        for (let ni = 0; ni < numNeighbors; ni++) {
                            val += scores[ni] * V[tokenNeighbors[ni]][offset + d];
                        }
                        attnOut[tq][offset + d] = val;
                    }
                }
                allScores.push(headScores);
            }

            this.attentionCache.push({
                Q,
                K,
                V,
                scores: allScores,
                scoreIndices: neighbors,
                attnOut: attnOut.map((t) => [...t]),
            });
            // FLOPS: sparse attention - sum actual pairs computed
            pr.addFlops("attention_scores", this.attentionPairsComputed * headDim * 4); // dot + weighted V
            pr.addAttentionPairs("attention_scores", this.attentionPairsComputed);
            pr.endPhase("attention_scores");

            // Output projection
            pr.startPhase("attention_proj");
            const projected: number[][] = [];
            for (let t = 0; t < numTokens; t++) {
                const proj = new Array(embedDim).fill(0);
                for (let e = 0; e < embedDim; e++) {
                    for (let s = 0; s < embedDim; s++) {
                        proj[e] += attnOut[t][s] * bw.projWeights[s * embedDim + e];
                    }
                    proj[e] += bw.projBias[e];
                }
                projected.push(proj);
            }

            pr.addFlops("attention_proj", numTokens * embedDim * embedDim * 2);
            pr.endPhase("attention_proj");

            // Residual 1
            for (let t = 0; t < numTokens; t++) {
                for (let e = 0; e < embedDim; e++) {
                    this.tokens[t][e] = preAttn[t][e] + projected[t][e];
                }
            }

            const preMlp = this.tokens.map((t) => [...t]);

            // LayerNorm 2
            pr.startPhase("layernorm");
            const ln2 = g.layerNorms[lnIdx + 1];
            const ln2Cache = { mean: [] as number[], invStd: [] as number[], normalized: [] as number[][] };
            for (let t = 0; t < numTokens; t++) {
                const r = layerNormForward(this.tokens[t], ln2);
                this.tokens[t] = r.output;
                ln2Cache.mean.push(r.mean);
                ln2Cache.invStd.push(r.invStd);
                ln2Cache.normalized.push(r.normalized);
            }
            this.layerNormCache.push(ln2Cache);
            pr.addFlops("layernorm", numTokens * embedDim * 5);
            pr.endPhase("layernorm");

            // MLP
            pr.startPhase("mlp");
            const mlpDim = embedDim * g.mlpRatio;
            const preGeluAll: number[][] = [];
            const hiddenAll: number[][] = [];
            const mlpOut: number[][] = [];

            for (let t = 0; t < numTokens; t++) {
                const preGelu = new Array(mlpDim);
                const hidden = new Array(mlpDim);
                for (let m = 0; m < mlpDim; m++) {
                    let sum = bw.mlp1Bias[m];
                    for (let e = 0; e < embedDim; e++) {
                        sum += this.tokens[t][e] * bw.mlp1Weights[e * mlpDim + m];
                    }
                    preGelu[m] = sum;
                    hidden[m] = gelu(sum);
                }
                preGeluAll.push(preGelu);
                hiddenAll.push(hidden);

                const out = new Array(embedDim);
                for (let e = 0; e < embedDim; e++) {
                    let sum = bw.mlp2Bias[e];
                    for (let m = 0; m < mlpDim; m++) {
                        sum += hidden[m] * bw.mlp2Weights[m * embedDim + e];
                    }
                    out[e] = sum;
                }
                mlpOut.push(out);
            }

            this.mlpCache.push({ preGelu: preGeluAll, hidden: hiddenAll });
            pr.addFlops("mlp", numTokens * embedDim * mlpDim * 2 + numTokens * mlpDim * embedDim * 2);
            pr.endPhase("mlp");

            // Residual 2
            for (let t = 0; t < numTokens; t++) {
                for (let e = 0; e < embedDim; e++) {
                    this.tokens[t][e] = preMlp[t][e] + mlpOut[t][e];
                }
            }

            this.residualCache.push({ preAttn, preMlp });
        }

        // Classification head (if not MAE mode)
        pr.startPhase("head");
        const classToken = this.tokens[0];
        if (g.numClasses > 0) {
            const logits = new Array(g.numClasses);
            for (let cls = 0; cls < g.numClasses; cls++) {
                let sum = g.headBias[cls];
                for (let e = 0; e < embedDim; e++) {
                    sum += classToken[e] * g.headWeights[e * g.numClasses + cls];
                }
                logits[cls] = sum;
            }
            pr.addFlops("head", embedDim * g.numClasses * 2);
            pr.endPhase("head");
            return softmax(logits);
        }

        pr.endPhase("head");
        return classToken; // MAE mode returns class token embedding
    }

    /// <summary>
    /// MAE-style per-patch reconstruction using spatial attention.
    /// </summary>
    public reconstructPatches(inputPixels: number[]): number[] {
        const g = this._graph;
        if (!g.patchDecoderWeights || !g.patchDecoderBias) {
            throw new Error("patchDecoderWeights not initialized");
        }

        this.run(inputPixels);

        const pr = this.profiler;
        pr.startPhase("patch_decoder");
        const embedDim = g.embedDim;
        const patchSize = g.patchSize;
        const imgChannels = Math.round(inputPixels.length / (g.numPatches * patchSize * patchSize));
        const imgWidth = Math.round(Math.sqrt(inputPixels.length / imgChannels));
        const patchesX = imgWidth / patchSize;
        const patchPixels = patchSize * patchSize * imgChannels;

        const output = new Array(inputPixels.length).fill(0);

        for (let p = 0; p < g.numPatches; p++) {
            const token = this.tokens[p + 1];
            const patchRow = Math.floor(p / patchesX);
            const patchCol = p % patchesX;

            for (let px = 0; px < patchPixels; px++) {
                let sum = g.patchDecoderBias[px];
                for (let e = 0; e < embedDim; e++) {
                    sum += token[e] * g.patchDecoderWeights[e * patchPixels + px];
                }
                sum = 1 / (1 + Math.exp(-sum)); // sigmoid

                const ch = px % imgChannels;
                const spatialIdx = Math.floor(px / imgChannels);
                const localY = Math.floor(spatialIdx / patchSize);
                const localX = spatialIdx % patchSize;
                const imgY = patchRow * patchSize + localY;
                const imgX = patchCol * patchSize + localX;
                const flatIdx = (imgY * imgWidth + imgX) * imgChannels + ch;
                output[flatIdx] = sum;
            }
        }

        pr.addFlops("patch_decoder", g.numPatches * embedDim * patchPixels * 2);
        pr.endPhase("patch_decoder");

        return output;
    }

    public clearContext(): void {
        this.tokens = [];
        this.layerNormCache = [];
        this.attentionCache = [];
        this.mlpCache = [];
        this.residualCache = [];
        this.attentionPairsComputed = 0;
    }
}
