/// <summary>
/// Interfaces for reconstruction quality metrics.
/// Designed for multi-channel spatial data where some channels
/// are sparse (e.g., obstacle height, velocity in LiDAR grids).
/// </summary>

/// <summary>Result of a single metric computation on one channel.</summary>
export interface IChannelMetrics {
    /** Channel index */
    channel: number;
    /** Channel name (optional) */
    name?: string;
    /** Standard MSE over all pixels */
    mse: number;
    /** RMSE = sqrt(mse) */
    rmse: number;
    /** MSE computed only on sparse (above-threshold) pixels */
    sparseMse: number;
    /** Proportion of real sparse pixels that were reconstructed above threshold */
    sparseRecall: number;
    /** Proportion of predicted sparse pixels that correspond to real ones */
    sparsePrecision: number;
    /** Harmonic mean of recall and precision */
    sparseF1: number;
    /** Ratio of preserved signal energy on sparse pixels */
    energyRetention: number;
    /** Fraction of top-K ground truth pixels found in top-K predicted */
    topKHitRate: number;
    /** Number of sparse pixels in ground truth */
    sparsePixelCount: number;
    /** Total pixel count in channel */
    totalPixelCount: number;
    /** Sparsity ratio (sparsePixelCount / totalPixelCount) */
    sparsity: number;
    /**
     * Contrast preservation ratio on sparse pixels.
     * Measures how well the model preserves the local contrast (peak vs neighbors)
     * of sparse features. A CNN that blurs an obstacle into a smooth bump will have
     * low contrast preservation, while attention-based models that maintain sharp
     * peaks will score closer to 1.0.
     * Formula: mean(pred_contrast / gt_contrast) for each sparse pixel,
     * where contrast = pixel_value - mean(spatial_neighbors).
     */
    contrastPreservation: number;
}

/// <summary>Aggregated metrics across all channels.</summary>
export interface IReconstructionMetrics {
    /** Per-channel detailed metrics */
    channels: IChannelMetrics[];
    /** Global MSE across all channels and pixels */
    globalMse: number;
    /** Global RMSE */
    globalRmse: number;
    /** Average sparse F1 across sparse channels only */
    avgSparseF1: number;
    /** Average energy retention across sparse channels only */
    avgEnergyRetention: number;
    /** Average top-K hit rate across sparse channels only */
    avgTopKHitRate: number;
    /** Average contrast preservation across sparse channels only */
    avgContrastPreservation: number;
    /** Indices of channels classified as sparse */
    sparseChannelIndices: number[];
    /** Indices of channels classified as dense */
    denseChannelIndices: number[];
}

/// <summary>Configuration for metrics computation.</summary>
export interface IMetricsConfig {
    /** Width of the spatial grid */
    width: number;
    /** Height of the spatial grid */
    height: number;
    /** Number of channels */
    channels: number;
    /** Channel names (optional, for display) */
    channelNames?: string[];
    /**
     * Per-channel threshold for classifying a pixel as "sparse/active".
     * A single number applies to all channels.
     * An array provides per-channel thresholds.
     * Default: 0.1
     */
    sparseThreshold?: number | number[];
    /**
     * K value for Top-K hit rate metric.
     * Can be absolute (integer >= 1) or relative (0 < float < 1 = fraction of pixels).
     * Default: 0.05 (top 5% of pixels)
     */
    topK?: number;
    /**
     * Minimum number of sparse pixels required to compute sparse metrics.
     * Channels with fewer sparse pixels are classified as dense.
     * Default: 3
     */
    minSparsePixels?: number;
}
