/// <summary>
/// Formatting utilities for reconstruction metrics.
/// Produces human-readable tables and summaries.
/// </summary>

import type { IReconstructionMetrics } from "./metrics.interfaces";

/// <summary>
/// Format reconstruction metrics as a human-readable string table.
/// </summary>
export function formatMetrics(metrics: IReconstructionMetrics): string {
    const lines: string[] = [];

    // Header
    lines.push("Reconstruction Quality Metrics");
    lines.push("=".repeat(120));
    lines.push(
        "Channel".padEnd(16) +
            "MSE".padEnd(10) +
            "RMSE".padEnd(10) +
            "SparseMSE".padEnd(12) +
            "Recall".padEnd(10) +
            "Precision".padEnd(12) +
            "F1".padEnd(10) +
            "ERR".padEnd(10) +
            "TopK".padEnd(10) +
            "Contrast".padEnd(10) +
            "Sparsity".padEnd(10) +
            "Type"
    );
    lines.push("-".repeat(130));

    for (const ch of metrics.channels) {
        const isSparse = metrics.sparseChannelIndices.includes(ch.channel);
        const label = ch.name ?? `Ch${ch.channel}`;
        lines.push(
            label.padEnd(16) +
                ch.mse.toFixed(4).padEnd(10) +
                ch.rmse.toFixed(4).padEnd(10) +
                (isSparse ? ch.sparseMse.toFixed(4) : "-").padEnd(12) +
                (isSparse ? ch.sparseRecall.toFixed(3) : "-").padEnd(10) +
                (isSparse ? ch.sparsePrecision.toFixed(3) : "-").padEnd(12) +
                (isSparse ? ch.sparseF1.toFixed(3) : "-").padEnd(10) +
                (isSparse ? ch.energyRetention.toFixed(3) : "-").padEnd(10) +
                (isSparse ? ch.topKHitRate.toFixed(3) : "-").padEnd(10) +
                (isSparse ? ch.contrastPreservation.toFixed(3) : "-").padEnd(10) +
                (ch.sparsity * 100).toFixed(1).padEnd(8) +
                "%" +
                (isSparse ? " SPARSE" : " DENSE")
        );
    }

    lines.push("-".repeat(120));

    // Summary
    lines.push("Global".padEnd(16) + metrics.globalMse.toFixed(4).padEnd(10) + metrics.globalRmse.toFixed(4));

    if (metrics.sparseChannelIndices.length > 0) {
        lines.push("");
        lines.push("Sparse channels summary:");
        lines.push(`  Avg Sparse F1:          ${metrics.avgSparseF1.toFixed(3)}`);
        lines.push(`  Avg Energy Retention:   ${metrics.avgEnergyRetention.toFixed(3)}`);
        lines.push(`  Avg Top-K Hit Rate:     ${metrics.avgTopKHitRate.toFixed(3)}`);
        lines.push(`  Avg Contrast Preserv.:  ${metrics.avgContrastPreservation.toFixed(3)}`);
    }

    return lines.join("\n");
}

/// <summary>
/// Format a comparison table between multiple models.
/// </summary>
export function formatMetricsComparison(results: { name: string; metrics: IReconstructionMetrics }[]): string {
    const lines: string[] = [];

    lines.push("Model Comparison");
    lines.push("=".repeat(100));
    lines.push("Model".padEnd(24) + "MSE".padEnd(10) + "RMSE".padEnd(10) + "SparseF1".padEnd(12) + "ERR".padEnd(10) + "TopK".padEnd(10) + "Sparse Ch");
    lines.push("-".repeat(100));

    for (const r of results) {
        lines.push(
            r.name.padEnd(24) +
                r.metrics.globalMse.toFixed(4).padEnd(10) +
                r.metrics.globalRmse.toFixed(4).padEnd(10) +
                r.metrics.avgSparseF1.toFixed(3).padEnd(12) +
                r.metrics.avgEnergyRetention.toFixed(3).padEnd(10) +
                r.metrics.avgTopKHitRate.toFixed(3).padEnd(10) +
                r.metrics.sparseChannelIndices.map((i) => r.metrics.channels[i].name ?? `Ch${i}`).join(", ")
        );
    }

    lines.push("-".repeat(100));

    // Per sparse channel breakdown
    if (results.length > 0 && results[0].metrics.sparseChannelIndices.length > 0) {
        lines.push("");
        lines.push("Per sparse channel F1:");
        for (const chIdx of results[0].metrics.sparseChannelIndices) {
            const chName = results[0].metrics.channels[chIdx].name ?? `Ch${chIdx}`;
            const row = `  ${chName.padEnd(14)}` + results.map((r) => r.metrics.channels[chIdx].sparseF1.toFixed(3).padEnd(12)).join("");
            lines.push(row);
        }
    }

    return lines.join("\n");
}
