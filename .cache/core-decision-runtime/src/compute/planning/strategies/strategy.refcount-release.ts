// ═══════════════════════════════════════════════════════════════════════════
// Refcount-release strategy : online first-fit with eager release.
//
// Walks tensors in birth order; before placing each one, drops every
// live slot whose death step is strictly before the current birth (its
// last consumer has already fired). Places the new tensor at the first
// gap large enough among the survivors, falling back to the top of the
// arena.
//
// This is the strategy a refcounted runtime achieves at runtime
// (decrement on each consume, free at zero) without any pre-planning.
// Cheap to implement, no global view; the offline strategies generally
// win by a few percent because they can reorder placements.
// ═══════════════════════════════════════════════════════════════════════════

import { buildPlan } from "../planning.metrics";
import type { IAllocation, IAllocationPlan, IAllocationStrategy, ITensorLifetime } from "../planning.interfaces";

interface LiveSlot {
    offset: number;
    bytes: number;
    deathStep: number;
}

export class RefcountReleaseStrategy implements IAllocationStrategy {
    public readonly name = "refcount-release";
    public constructor(private readonly schedulerName = "kahn-fifo") {}

    public plan(lifetimes: readonly ITensorLifetime[], schedule: readonly string[]): IAllocationPlan {
        const sorted = [...lifetimes].sort((a, b) => a.birthStep - b.birthStep || a.tensorId.localeCompare(b.tensorId));

        const live: LiveSlot[] = [];
        const allocations = new Map<string, IAllocation>();

        for (const t of sorted) {
            // Drop dead slots: their last consumer fired before the
            // current producer step.
            for (let i = live.length - 1; i >= 0; i--) {
                if (live[i].deathStep < t.birthStep) live.splice(i, 1);
            }

            // First-fit among the survivors, sorted by offset.
            live.sort((a, b) => a.offset - b.offset);
            let offset = 0;
            for (const slot of live) {
                if (slot.offset >= offset + t.bytes) break;
                offset = Math.max(offset, slot.offset + slot.bytes);
            }

            allocations.set(t.tensorId, { tensorId: t.tensorId, offset, bytes: t.bytes });
            live.push({ offset, bytes: t.bytes, deathStep: t.deathStep });
        }

        return buildPlan(this.name, this.schedulerName, schedule, allocations, lifetimes);
    }
}
