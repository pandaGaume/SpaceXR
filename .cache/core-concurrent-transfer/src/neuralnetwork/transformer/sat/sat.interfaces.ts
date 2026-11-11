import { IVitGraph, IVitConfig } from "../vit/vit.interfaces";

// ---------------------------------------------------------------------------
// Spatial Attention Transformer - Interfaces
// ---------------------------------------------------------------------------

/// <summary>
/// Configuration for Spatial Attention Transformer.
/// Extends ViT config with spatial radius for attention.
/// </summary>
export interface ISatConfig extends IVitConfig {
    /// <summary>
    /// Attention radius per block (Chebyshev distance in patch grid).
    /// - number: same radius for all blocks
    /// - number[]: per-block radius (length must match numBlocks)
    /// - Infinity: attend to all patches (= standard ViT)
    /// - 1: attend only to 3x3 neighbors (= CNN-like local)
    /// </summary>
    radius: number | number[];
    /// <summary>Enable per-patch MAE reconstruction (default: false = classification)</summary>
    patchDecode?: boolean;
}

/// <summary>
/// Spatial Attention Transformer graph.
/// Extends VitGraph with neighbor map and per-block radius.
/// </summary>
export interface ISatGraph extends IVitGraph {
    /// <summary>Per-block attention radius</summary>
    radiusPerBlock: number[];
    /// <summary>
    /// Pre-computed neighbor map per block.
    /// neighborMaps[block][tokenIdx] = array of token indices to attend to.
    /// Class token (index 0) always attends to all tokens.
    /// </summary>
    neighborMaps: number[][][];
    /// <summary>Number of attention pairs per block (for benchmarking)</summary>
    attentionPairsPerBlock: number[];
}

/// <summary>
/// Pre-configured SAT architectures for LiDAR (16x16x6).
/// </summary>
export const SatPresets = {
    /// <summary>Local attention only - like CNN receptive field</summary>
    local: {
        width: 16,
        height: 16,
        channels: 6,
        patchSize: 4,
        embedDim: 64,
        numHeads: 4,
        numBlocks: 2,
        mlpRatio: 2,
        numClasses: 10,
        radius: [1, 1],
        patchDecode: true,
    } as ISatConfig,

    /// <summary>Hierarchical - local in block 1, broader in block 2</summary>
    hierarchical: {
        width: 16,
        height: 16,
        channels: 6,
        patchSize: 4,
        embedDim: 64,
        numHeads: 4,
        numBlocks: 2,
        mlpRatio: 2,
        numClasses: 10,
        radius: [1, 3],
        patchDecode: true,
    } as ISatConfig,

    /// <summary>Progressive - local in block 1, global in block 2</summary>
    progressive: {
        width: 16,
        height: 16,
        channels: 6,
        patchSize: 4,
        embedDim: 64,
        numHeads: 4,
        numBlocks: 2,
        mlpRatio: 2,
        numClasses: 10,
        radius: [1, Infinity],
        patchDecode: true,
    } as ISatConfig,
};
