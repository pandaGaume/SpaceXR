// ═══════════════════════════════════════════════════════════════════════════
// Plan metrics : analysis helpers consumed by the memory-viz UI and any
// future export logic. All functions are pure and operate on
// `(IAllocationPlan, ITensorLifetime[])`.
// ═══════════════════════════════════════════════════════════════════════════

import type { IAllocation, IAllocationPlan, ITensorLifetime } from "./planning.interfaces";

// ─── Liveness ────────────────────────────────────────────────────────────────

/** Tensors that are alive at the given schedule step. */
export function liveAtStep(lifetimes: readonly ITensorLifetime[], step: number): ITensorLifetime[] {
    const out: ITensorLifetime[] = [];
    for (const t of lifetimes) {
        if (t.birthStep <= step && t.deathStep >= step) out.push(t);
    }
    return out;
}

/**
 * Sum of bytes of live tensors at a step. This is the working-set size
 * a perfect allocator would need at that moment.
 */
export function liveBytesAtStep(lifetimes: readonly ITensorLifetime[], step: number): number {
    let sum = 0;
    for (const t of lifetimes) {
        if (t.birthStep <= step && t.deathStep >= step) sum += t.bytes;
    }
    return sum;
}

/**
 * Theoretical lower bound on arena size: `max over all steps of the
 * sum of live tensor bytes`. No allocator can do better than this on
 * a fixed schedule.
 */
export function maxSimultaneousBytes(lifetimes: readonly ITensorLifetime[], numSteps: number): number {
    let best = 0;
    for (let s = 0; s < numSteps; s++) {
        const b = liveBytesAtStep(lifetimes, s);
        if (b > best) best = b;
    }
    return best;
}

// ─── Arena occupancy under a plan ────────────────────────────────────────────

/** `max(offset + bytes)` across every allocation in the plan. */
export function computePeak(plan: IAllocationPlan): number {
    let peak = 0;
    for (const alloc of plan.allocations.values()) {
        const top = alloc.offset + alloc.bytes;
        if (top > peak) peak = top;
    }
    return peak;
}

/**
 * High-water mark of allocated offsets at the given step (the
 * effective arena footprint when scrubbing).
 */
export function currentMemoryAtStep(plan: IAllocationPlan, lifetimes: readonly ITensorLifetime[], step: number): number {
    let peak = 0;
    for (const t of lifetimes) {
        if (t.birthStep <= step && t.deathStep >= step) {
            const alloc = plan.allocations.get(t.tensorId);
            if (!alloc) continue;
            const top = alloc.offset + alloc.bytes;
            if (top > peak) peak = top;
        }
    }
    return peak;
}

/** High-water marks at every step (for sparklines). */
export function memoryOverTime(plan: IAllocationPlan, lifetimes: readonly ITensorLifetime[], numSteps: number): number[] {
    const out = new Array<number>(numSteps);
    for (let s = 0; s < numSteps; s++) {
        out[s] = currentMemoryAtStep(plan, lifetimes, s);
    }
    return out;
}

/** Step at which `currentMemoryAtStep` reaches its maximum value. */
export function peakStep(plan: IAllocationPlan, lifetimes: readonly ITensorLifetime[], numSteps: number): { step: number; bytes: number } {
    let bestStep = 0;
    let bestBytes = 0;
    for (let s = 0; s < numSteps; s++) {
        const b = currentMemoryAtStep(plan, lifetimes, s);
        if (b > bestBytes) {
            bestBytes = b;
            bestStep = s;
        }
    }
    return { step: bestStep, bytes: bestBytes };
}

/** Step where the live-set count is maximal. */
export function maxLiveCount(lifetimes: readonly ITensorLifetime[], numSteps: number): { step: number; count: number } {
    let bestStep = 0;
    let bestCount = 0;
    for (let s = 0; s < numSteps; s++) {
        let c = 0;
        for (const t of lifetimes) {
            if (t.birthStep <= s && t.deathStep >= s) c++;
        }
        if (c > bestCount) {
            bestCount = c;
            bestStep = s;
        }
    }
    return { step: bestStep, count: bestCount };
}

// ─── Overhead vs theoretical minimum ─────────────────────────────────────────

/**
 * Plan overhead: `1 - minBound / peak`. Zero = optimal (no gap above
 * the inevitable working set); high = strategy wastes arena space.
 */
export function overhead(plan: IAllocationPlan): number {
    if (plan.peakBytes === 0) return 0;
    return Math.max(0, 1 - plan.minBound / plan.peakBytes);
}

// ─── Plan finalizer (used by strategies) ─────────────────────────────────────

/**
 * Assemble a finished `IAllocationPlan` from a strategy's offset
 * decisions. Strategies build a `Map<tensorId, IAllocation>`; this
 * helper computes the derived metrics (peak, minBound) once.
 */
export function buildPlan(
    strategyName: string,
    schedulerName: string,
    schedule: readonly string[],
    allocations: Map<string, IAllocation>,
    lifetimes: readonly ITensorLifetime[]
): IAllocationPlan {
    let peak = 0;
    for (const alloc of allocations.values()) {
        const top = alloc.offset + alloc.bytes;
        if (top > peak) peak = top;
    }
    const minBound = maxSimultaneousBytes(lifetimes, schedule.length);
    return {
        schedule,
        allocations,
        peakBytes: peak,
        minBound,
        metadata: { strategy: strategyName, scheduler: schedulerName },
    };
}
