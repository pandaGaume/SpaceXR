// ═══════════════════════════════════════════════════════════════════════════
// Arena-planned first-fit strategy : offline, birth-order, first-fit.
//
// Same shape as the refcount-release strategy but with global view:
// processes tensors in birth order and places each one at the lowest
// offset that does not overlap any already-placed tensor whose lifetime
// intersects the new tensor's `[birthStep, deathStep]` window.
//
// Differs from refcount-release in that placement decisions can use
// the full schedule (a tensor placed at step 3 may be assigned an
// offset that conflicts with a step-5 tensor that has already been
// dropped; offline knows all temporal overlaps). On linear graphs the
// two converge; on graphs with branches and skip connections the
// offline pass wins.
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

export class ArenaFirstFitStrategy implements IAllocationStrategy {
    public readonly name = "arena-planned-firstfit";
    public constructor(private readonly schedulerName = "kahn-fifo") {}

    public plan(lifetimes: readonly ITensorLifetime[], schedule: readonly string[]): IAllocationPlan {
        const sorted = [...lifetimes].sort((a, b) => a.birthStep - b.birthStep || a.tensorId.localeCompare(b.tensorId));

        const placed: Placed[] = [];
        for (const t of sorted) {
            const conflicts = placed.filter((p) => temporalOverlap(p, t)).sort((a, b) => a.offset - b.offset);

            let offset = 0;
            for (const c of conflicts) {
                if (c.offset >= offset + t.bytes) break;
                offset = Math.max(offset, c.offset + c.bytes);
            }

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
