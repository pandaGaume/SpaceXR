/// <summary>
/// Generic profiler for neural network inference and training.
///
/// Tracks two types of metrics per named phase:
///   - Time (ms): wall-clock duration using performance.now()
///   - FLOPS: floating-point operations (additions + multiplications)
///
/// Usage:
///   const profiler = new Profiler();
///
///   // Manual timing
///   profiler.startPhase("attention");
///   ... computation ...
///   profiler.endPhase("attention");
///
///   // FLOPS tracking
///   profiler.addFlops("attention", numTokens * numTokens * headDim * 2);
///
///   // Results
///   profiler.getSummary();  // { phases: [...], totalTime, totalFlops }
///
/// Can be enabled/disabled at runtime. When disabled, all calls are no-ops
/// with zero overhead.
/// </summary>
export class Profiler {
    private _enabled: boolean;
    private _phases: Map<string, IPhaseStats>;
    private _activePhase: string | null = null;
    private _phaseStart: number = 0;
    private _order: string[] = [];

    constructor(enabled: boolean = false) {
        this._enabled = enabled;
        this._phases = new Map();
    }

    /// <summary>Enable or disable profiling at runtime.</summary>
    public get enabled(): boolean {
        return this._enabled;
    }
    public set enabled(v: boolean) {
        this._enabled = v;
    }

    /// <summary>Start timing a named phase. Phases can be nested conceptually but not in timing.</summary>
    public startPhase(name: string): void {
        if (!this._enabled) return;
        if (this._activePhase) {
            this.endPhase(this._activePhase);
        }
        this._activePhase = name;
        this._phaseStart = performance.now();
    }

    /// <summary>End timing the current phase.</summary>
    public endPhase(name: string): void {
        if (!this._enabled) return;
        if (this._activePhase !== name) return;

        const elapsed = performance.now() - this._phaseStart;
        const stats = this._getOrCreate(name);
        stats.timeMs += elapsed;
        stats.calls++;
        this._activePhase = null;
    }

    /// <summary>Add FLOPS to a named phase (can be called anytime).</summary>
    public addFlops(name: string, flops: number): void {
        if (!this._enabled) return;
        this._getOrCreate(name).flops += flops;
    }

    /// <summary>Add attention pairs count to a named phase.</summary>
    public addAttentionPairs(name: string, pairs: number): void {
        if (!this._enabled) return;
        this._getOrCreate(name).attentionPairs += pairs;
    }

    /// <summary>Reset all collected data.</summary>
    public reset(): void {
        this._phases.clear();
        this._order = [];
        this._activePhase = null;
    }

    /// <summary>Get profiling summary ordered by phase registration.</summary>
    public getSummary(): IProfileSummary {
        let totalTime = 0;
        let totalFlops = 0;
        let totalAttentionPairs = 0;

        const phases: IPhaseResult[] = [];

        for (const name of this._order) {
            const stats = this._phases.get(name)!;
            totalTime += stats.timeMs;
            totalFlops += stats.flops;
            totalAttentionPairs += stats.attentionPairs;
            phases.push({
                name,
                timeMs: stats.timeMs,
                timePct: 0, // computed below
                flops: stats.flops,
                flopsPct: 0,
                attentionPairs: stats.attentionPairs,
                calls: stats.calls,
            });
        }

        // Compute percentages
        for (const p of phases) {
            p.timePct = totalTime > 0 ? (p.timeMs / totalTime) * 100 : 0;
            p.flopsPct = totalFlops > 0 ? (p.flops / totalFlops) * 100 : 0;
        }

        return { phases, totalTimeMs: totalTime, totalFlops, totalAttentionPairs };
    }

    /// <summary>Format summary as a human-readable string.</summary>
    public toString(): string {
        const s = this.getSummary();
        const lines: string[] = [];

        lines.push(`Profiler Summary (${s.totalTimeMs.toFixed(2)}ms, ${formatFlops(s.totalFlops)} FLOPS, ${s.totalAttentionPairs} attn pairs)`);
        lines.push("-".repeat(90));
        lines.push("Phase".padEnd(24) + "Time (ms)".padEnd(12) + "Time %".padEnd(10) + "FLOPS".padEnd(14) + "FLOPS %".padEnd(10) + "Attn pairs".padEnd(12) + "Calls");
        lines.push("-".repeat(90));

        for (const p of s.phases) {
            lines.push(
                p.name.padEnd(24) +
                    p.timeMs.toFixed(2).padEnd(12) +
                    (p.timePct.toFixed(1) + "%").padEnd(10) +
                    formatFlops(p.flops).padEnd(14) +
                    (p.flopsPct.toFixed(1) + "%").padEnd(10) +
                    String(p.attentionPairs).padEnd(12) +
                    String(p.calls)
            );
        }

        return lines.join("\n");
    }

    private _getOrCreate(name: string): IPhaseStats {
        if (!this._phases.has(name)) {
            this._phases.set(name, { timeMs: 0, flops: 0, attentionPairs: 0, calls: 0 });
            this._order.push(name);
        }
        return this._phases.get(name)!;
    }
}

// ---------------------------------------------------------------------------
// Interfaces
// ---------------------------------------------------------------------------

interface IPhaseStats {
    timeMs: number;
    flops: number;
    attentionPairs: number;
    calls: number;
}

export interface IPhaseResult {
    name: string;
    timeMs: number;
    timePct: number;
    flops: number;
    flopsPct: number;
    attentionPairs: number;
    calls: number;
}

export interface IProfileSummary {
    phases: IPhaseResult[];
    totalTimeMs: number;
    totalFlops: number;
    totalAttentionPairs: number;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatFlops(flops: number): string {
    if (flops >= 1e9) return (flops / 1e9).toFixed(2) + "G";
    if (flops >= 1e6) return (flops / 1e6).toFixed(2) + "M";
    if (flops >= 1e3) return (flops / 1e3).toFixed(1) + "K";
    return String(flops);
}
