// ═══════════════════════════════════════════════════════════════════════════
// Arena-planned greedy-by-size strategy : offline, largest-first, best-fit.
//
// Mirrors the TensorFlow Lite Micro greedy planner. Sorts tensors by
// decreasing size, then for each tensor picks the lowest-offset gap
// that fits among temporal conflicts (best-fit). This usually packs
// the largest tensors flush against offset 0 and slots smaller ones
// into the gaps, which is the practical optimum on most CNN-style
// graphs.
//
// Caveats : like every greedy heuristic this is not provably optimal.
// On pathological graphs with long-lived small tensors, the planner
// may push them on top of larger ones; the exact optimum needs an
// ILP solver which is beyond MCU planning budgets.
// ═══════════════════════════════════════════════════════════════════════════

import { buildPlan } from "../planning.metrics";
import type { IAllocation, IAllocationPlan, IAllocationStrategy, ITensorLifetime } from "../planning.interfaces";

interface Placed extends IAllocation {
    birthStep: number;
    deathStep: number;
}

function temporalOverlap(a: Placed, b: ITensorLifetime): boolean {
    return !(a.deathStep < b.birthStep || a.birthStep > b.deathStep);
}

export class ArenaGreedyStrategy implements IAllocationStrategy {
    public readonly name = "arena-planned-greedy";
    public constructor(private readonly schedulerName = "kahn-fifo") {}

    public plan(lifetimes: readonly ITensorLifetime[], schedule: readonly string[]): IAllocationPlan {
        const sorted = [...lifetimes].sort((a, b) => b.bytes - a.bytes || a.tensorId.localeCompare(b.tensorId));

        const placed: Placed[] = [];
        for (const t of sorted) {
            const conflicts = placed.filter((p) => temporalOverlap(p, t)).sort((a, b) => a.offset - b.offset);

            // Best-fit: scan gaps between consecutive conflicts, keep
            // the smallest one that still fits. If none fits, append at
            // the end (cursor).
            let bestOffset = -1;
            let bestGap = Number.POSITIVE_INFINITY;
            let cursor = 0;
            for (const c of conflicts) {
                const gap = c.offset - cursor;
                if (gap >= t.bytes && gap < bestGap) {
                    bestGap = gap;
                    bestOffset = cursor;
                }
                cursor = Math.max(cursor, c.offset + c.bytes);
            }
            const offset = bestOffset >= 0 ? bestOffset : cursor;

            placed.push({
                tensorId: t.tensorId,
                offset,
                bytes: t.bytes,
                birthStep: t.birthStep,
                deathStep: t.deathStep,
            });
        }

        const allocations = new Map<string, IAllocation>();
        for (const p of placed) {
            allocations.set(p.tensorId, { tensorId: p.tensorId, offset: p.offset, bytes: p.bytes });
        }

        return buildPlan(this.name, this.schedulerName, schedule, allocations, lifetimes);
    }
}
