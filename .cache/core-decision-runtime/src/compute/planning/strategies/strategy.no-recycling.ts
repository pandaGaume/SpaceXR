// ═══════════════════════════════════════════════════════════════════════════
// No-recycling strategy : stack tensors sequentially, never reuse.
//
// Matches the current CyanMycelium v1 behaviour (bump arena that
// monotonically grows during a Run, reset between runs). The peak is
// the sum of every transient that exists, which makes it the worst
// realistic baseline against which the other strategies are compared.
// ═══════════════════════════════════════════════════════════════════════════

import { buildPlan } from "../planning.metrics";
import type { IAllocation, IAllocationPlan, IAllocationStrategy, ITensorLifetime } from "../planning.interfaces";

export class NoRecyclingStrategy implements IAllocationStrategy {
    public readonly name = "no-recycling";
    public constructor(private readonly schedulerName = "kahn-fifo") {}

    public plan(lifetimes: readonly ITensorLifetime[], schedule: readonly string[]): IAllocationPlan {
        const sorted = [...lifetimes].sort((a, b) => a.birthStep - b.birthStep || a.tensorId.localeCompare(b.tensorId));

        const allocations = new Map<string, IAllocation>();
        let offset = 0;
        for (const t of sorted) {
            allocations.set(t.tensorId, { tensorId: t.tensorId, offset, bytes: t.bytes });
            offset += t.bytes;
        }

        return buildPlan(this.name, this.schedulerName, schedule, allocations, lifetimes);
    }
}
