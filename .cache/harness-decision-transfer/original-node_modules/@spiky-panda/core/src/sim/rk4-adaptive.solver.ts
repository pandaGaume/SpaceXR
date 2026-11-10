import type { IChannel, ISession, IRuntimeNode } from "../execution/execution.interfaces";
import type { IIntegrable, IIntegrationInputs, ISolver, ISolverStep } from "./sim.interfaces";

/**
 * RK4 Cash-Karp adaptive solver. Explicit, non-stiff. Suitable for the
 * F3 canary (DC motor electrical/mechanical, τ_e ≈ 1 ms) and most
 * mechanical / vibration leaves we already ship. Switch to Rosenbrock
 * (Phase 2 of the plan) when Sabatier kinetics or other stiff systems
 * land.
 *
 * Approach:
 *   - Single shared state vector `y` indexed per-leaf by `_offsets[i]`.
 *   - Each macro-step advances by `dt`. Internally the solver may
 *     subdivide into N micro-steps if the embedded 5(4) error estimate
 *     exceeds `tolerance`. Step size is shrunk to the worst-case
 *     leaf-slot ratio, with a safety factor of 0.9.
 *   - Per-leaf rhs evaluations snapshot upstream inputs ONCE per macro
 *     step (per the v2 plan, Q1.2 resolution). All micro-steps inside
 *     one macro-step share the same input snapshot; trade-off is
 *     a minute lag (≤ one macro-step) on rapidly-changing inputs.
 *
 * Cash-Karp coefficients chosen because:
 *   - widely used (Numerical Recipes ch. 17),
 *   - 5th-order solution with embedded 4th-order error estimate at no
 *     extra rhs cost beyond the 6 stage evaluations.
 */

// ── Cash-Karp tableau (Butcher) ────────────────────────────────────
// Stage time offsets.
const C2 = 1 / 5;
const C3 = 3 / 10;
const C4 = 3 / 5;
const C5 = 1.0;
const C6 = 7 / 8;
// Stage-coefficient matrix.
const A21 = 1 / 5;
const A31 = 3 / 40,
    A32 = 9 / 40;
const A41 = 3 / 10,
    A42 = -9 / 10,
    A43 = 6 / 5;
const A51 = -11 / 54,
    A52 = 5 / 2,
    A53 = -70 / 27,
    A54 = 35 / 27;
const A61 = 1631 / 55296,
    A62 = 175 / 512,
    A63 = 575 / 13824,
    A64 = 44275 / 110592,
    A65 = 253 / 4096;
// 5th-order weights.
const B1 = 37 / 378,
    B3 = 250 / 621,
    B4 = 125 / 594,
    B6 = 512 / 1771;
// 4th-order weights (for error estimate). Difference (B - B*) gives the
// embedded error vector.
const E1 = 37 / 378 - 2825 / 27648;
const E3 = 250 / 621 - 18575 / 48384;
const E4 = 125 / 594 - 13525 / 55296;
const E5 = -277 / 14336;
const E6 = 512 / 1771 - 1 / 4;

export interface IRK4AdaptiveOptions {
    /** Relative+absolute error threshold per state entry. Default 1e-6. */
    readonly tolerance?: number;
    /** Hard upper bound on adaptive step size. Default 10 ms — caps
     *  divergence when the solver tries to overshoot a transient. */
    readonly maxStep?: number;
    /** Minimum step size before the solver gives up. Below this, we
     *  accept the step regardless of error and emit a warning via the
     *  diagnostic report (the `maxError` field reflects the bad case). */
    readonly minStep?: number;
}

/**
 * Lightweight `IIntegrationInputs` impl backed by a plain Map. Lives
 * inside the solver so we don't allocate fresh objects per rhs call —
 * the map is reused across stages within one macro-step.
 */
class InputsSnapshot implements IIntegrationInputs {
    private readonly _data = new Map<string, number>();

    public get(port: string): number | undefined {
        return this._data.get(port);
    }
    public has(port: string): boolean {
        return this._data.has(port);
    }
    public sumPrefix(prefix: string): number {
        let total = 0;
        for (const [port, value] of this._data) {
            if (port.startsWith(prefix)) total += value;
        }
        return total;
    }
    public set(port: string, value: number): void {
        this._data.set(port, value);
    }
    public clear(): void {
        this._data.clear();
    }
}

export class RK4AdaptiveSolver implements ISolver {
    public readonly name = "RK4 Cash-Karp adaptive";
    public readonly supportsJacobian = false;

    private readonly _tolerance: number;
    private readonly _maxStep: number;
    private readonly _minStep: number;

    private _leaves: ReadonlyArray<IIntegrable> = [];
    private _offsets: number[] = [];
    private _totalSize = 0;

    // State + scratch buffers. Allocated once at initialize().
    private _y: Float64Array = new Float64Array(0);
    private _k1: Float64Array = new Float64Array(0);
    private _k2: Float64Array = new Float64Array(0);
    private _k3: Float64Array = new Float64Array(0);
    private _k4: Float64Array = new Float64Array(0);
    private _k5: Float64Array = new Float64Array(0);
    private _k6: Float64Array = new Float64Array(0);
    private _yTry: Float64Array = new Float64Array(0);
    private _yErr: Float64Array = new Float64Array(0);

    // One reusable inputs snapshot per leaf — keyed by leaf index in
    // `_leaves`. The snapshot is rebuilt once per macro-step from the
    // session's linkStates and held constant across micro-steps.
    private _inputs: InputsSnapshot[] = [];

    private _t = 0;
    private _suggestedStep = 0;
    private _lastStep: ISolverStep | null = null;

    public constructor(opts: IRK4AdaptiveOptions = {}) {
        this._tolerance = opts.tolerance ?? 1e-6;
        this._maxStep = opts.maxStep ?? 1e-2;
        this._minStep = opts.minStep ?? 1e-9;
    }

    public get lastStep(): ISolverStep | null {
        return this._lastStep;
    }

    public initialize(leaves: ReadonlyArray<IIntegrable>, t0: number): void {
        this._leaves = leaves;
        this._offsets = [];
        let offset = 0;
        for (const leaf of leaves) {
            this._offsets.push(offset);
            offset += leaf.stateSize;
        }
        this._totalSize = offset;
        this._y = new Float64Array(this._totalSize);
        this._k1 = new Float64Array(this._totalSize);
        this._k2 = new Float64Array(this._totalSize);
        this._k3 = new Float64Array(this._totalSize);
        this._k4 = new Float64Array(this._totalSize);
        this._k5 = new Float64Array(this._totalSize);
        this._k6 = new Float64Array(this._totalSize);
        this._yTry = new Float64Array(this._totalSize);
        this._yErr = new Float64Array(this._totalSize);
        this._inputs = leaves.map(() => new InputsSnapshot());
        this._t = t0;
        // Seed `_y` from each leaf's current state.
        for (let i = 0; i < leaves.length; i++) {
            leaves[i].gatherState(this._y, this._offsets[i]);
        }
        // Initial guess for the adaptive step size: half of the macro
        // step the host is likely to use. The very first macro-step
        // will tune this based on observed error.
        this._suggestedStep = Math.min(this._maxStep, 1e-3);
    }

    /** Re-seed `_y` from the leaves and rewind to `t0` (see ISolverHandle.reseed). */
    public reseed(t0: number): void {
        for (let i = 0; i < this._leaves.length; i++) {
            this._leaves[i].gatherState(this._y, this._offsets[i]);
        }
        this._t = t0;
        this._suggestedStep = Math.min(this._maxStep, 1e-3);
        this._lastStep = null;
    }

    public step(dt: number, session: ISession): ISolverStep {
        if (this._totalSize === 0 || this._leaves.length === 0) {
            this._lastStep = { t: this._t + dt, microSteps: 0, maxError: 0, rhsEvals: 0 };
            this._t += dt;
            return this._lastStep;
        }

        // Re-read the leaves' state before integrating. Between two macro-
        // steps the dispatch phase runs, and a producer may have written a
        // leaf's state directly (an AtmosphereGate applies its per-species
        // mass transfer with `applyMassDelta`, a restore node rewrites a
        // state): integrating the vector kept from the previous step and
        // writing it back would silently erase those writes. Reading the
        // leaves is idempotent when nothing touched them (writeState was
        // the last writer), so this costs one copy per leaf per step.
        for (let i = 0; i < this._leaves.length; i++) {
            this._leaves[i].gatherState(this._y, this._offsets[i]);
        }

        // Snapshot upstream inputs once per macro-step. The snapshot is
        // held constant across all micro-steps below (per Q1.2). This
        // is structurally important: re-reading the session linkStates
        // per stage would mean the solver sees a different input vector
        // at each stage, which breaks the embedded error estimator's
        // assumption that rhs(t, y) is a deterministic function of y.
        this._snapshotInputs(session);

        const tEnd = this._t + dt;
        let microSteps = 0;
        let rhsEvals = 0;
        let maxErr = 0;
        let h = Math.min(this._suggestedStep, dt);
        // `goodH` is the LAST h that survived an accept WITHOUT being
        // shrunk by an overshoot clip. It's what we save back into
        // `_suggestedStep` at the end so the next macro-step starts
        // with a reasonable estimate. Without this distinction we'd
        // sometimes save the FP-epsilon-sized remainder of the previous
        // macro-step (when the while-loop tried one extra iteration due
        // to floating-point drift on `_t < tEnd`), which then makes
        // the NEXT macro-step's safety break trigger immediately and
        // the integrator effectively halts.
        let goodH = h;
        // Safety cap on micro-steps: when the input signal has
        // discontinuities (PWM switching), the adaptive controller
        // shrinks the step indefinitely trying to resolve the jump.
        // Without this cap, a single macro-step can spin forever. The
        // cap is generous (10k micro-steps = 60k rhs evals per macro)
        // so normal smooth dynamics aren't affected. When we hit the
        // cap we accept whatever state we have and move on — the
        // user is warned via maxError in the diagnostic report.
        const microStepCap = 10000;

        while (this._t < tEnd) {
            // Don't overshoot the macro-step boundary. Save the un-
            // clipped h first: if we shrink it just to land exactly on
            // tEnd, that shrunken value is NOT a sensible next-macro
            // starting point (it's an FP remainder, not a step the
            // dynamics dictated). `goodH` tracks the last "real" step.
            const hBeforeClip = h;
            if (this._t + h > tEnd) h = tEnd - this._t;
            // Floating-point safety: if h has shrunk below machine
            // epsilon relative to tEnd, force-finish the macro-step.
            // Without this, _t += h becomes a no-op (h gets lost in
            // floating-point precision) and we loop forever.
            if (h <= Math.abs(tEnd) * Number.EPSILON * 8 || h < this._minStep) {
                this._t = tEnd;
                break;
            }
            // Hard cap to defend against runaway shrinkage on
            // discontinuous inputs (PWM, switched loads).
            if (microSteps >= microStepCap) {
                this._t = tEnd;
                break;
            }

            const err = this._tryStep(h);
            rhsEvals += 6;

            if (err <= 1) {
                // Accept: commit yTry → y, advance time, grow step.
                this._y.set(this._yTry);
                this._t += h;
                microSteps++;
                if (err > maxErr) maxErr = err;
                // Growth: factor = 0.9 * err^(-0.2), capped at 5×.
                const growth = err === 0 ? 5 : Math.min(5, 0.9 * Math.pow(err, -0.2));
                h = Math.min(this._maxStep, h * growth);
                // Update `goodH` from the PRE-clip value if this step
                // wasn't shrunk only to land on tEnd. The clipped h is
                // useless as a forecast for the next macro-step.
                if (hBeforeClip === h || hBeforeClip <= this._maxStep) goodH = h;
            } else {
                // Reject: shrink and retry, capped at 10× shrink.
                const shrink = Math.max(0.1, 0.9 * Math.pow(err, -0.25));
                h = Math.max(this._minStep, h * shrink);
                if (h <= this._minStep) {
                    // Forced acceptance to make progress; downstream
                    // sees a maxError > tolerance so they can react.
                    this._y.set(this._yTry);
                    this._t += h;
                    microSteps++;
                    if (err > maxErr) maxErr = err;
                }
            }
        }

        // Write final accepted state back to each leaf.
        for (let i = 0; i < this._leaves.length; i++) {
            this._leaves[i].writeState(this._y, this._offsets[i]);
        }

        this._suggestedStep = goodH;
        this._lastStep = { t: this._t, microSteps, maxError: maxErr, rhsEvals };
        return this._lastStep;
    }

    public dispose(): void {
        // Drop typed array references so V8 can collect them sooner;
        // tiny graphs allocate a few hundred bytes total, but a Helios
        // sim with hundreds of leaves accumulates real megabytes.
        this._y = new Float64Array(0);
        this._k1 = new Float64Array(0);
        this._k2 = new Float64Array(0);
        this._k3 = new Float64Array(0);
        this._k4 = new Float64Array(0);
        this._k5 = new Float64Array(0);
        this._k6 = new Float64Array(0);
        this._yTry = new Float64Array(0);
        this._yErr = new Float64Array(0);
        this._inputs = [];
        this._leaves = [];
        this._offsets = [];
        this._totalSize = 0;
    }

    // ── Internals ──────────────────────────────────────────────────────

    /**
     * Compute one trial Cash-Karp step of size `h` from `_y`. Writes
     * `_yTry` (candidate next state) and `_yErr` (embedded error
     * vector). Returns the normalised L∞ error against `tolerance`;
     * caller accepts when ≤ 1.
     */
    private _tryStep(h: number): number {
        const n = this._totalSize;
        const t = this._t;

        // k1 = f(t, y)
        this._evalRhs(t, this._y, this._k1);

        // k2 = f(t + c2*h, y + h*a21*k1)
        for (let i = 0; i < n; i++) this._yTry[i] = this._y[i] + h * A21 * this._k1[i];
        this._evalRhs(t + C2 * h, this._yTry, this._k2);

        // k3 = f(t + c3*h, y + h*(a31*k1 + a32*k2))
        for (let i = 0; i < n; i++) this._yTry[i] = this._y[i] + h * (A31 * this._k1[i] + A32 * this._k2[i]);
        this._evalRhs(t + C3 * h, this._yTry, this._k3);

        // k4 = f(t + c4*h, y + h*(a41*k1 + a42*k2 + a43*k3))
        for (let i = 0; i < n; i++) this._yTry[i] = this._y[i] + h * (A41 * this._k1[i] + A42 * this._k2[i] + A43 * this._k3[i]);
        this._evalRhs(t + C4 * h, this._yTry, this._k4);

        // k5 = f(t + c5*h, y + h*(a51*k1 + a52*k2 + a53*k3 + a54*k4))
        for (let i = 0; i < n; i++) this._yTry[i] = this._y[i] + h * (A51 * this._k1[i] + A52 * this._k2[i] + A53 * this._k3[i] + A54 * this._k4[i]);
        this._evalRhs(t + C5 * h, this._yTry, this._k5);

        // k6 = f(t + c6*h, y + h*(a61*k1 + a62*k2 + a63*k3 + a64*k4 + a65*k5))
        for (let i = 0; i < n; i++) this._yTry[i] = this._y[i] + h * (A61 * this._k1[i] + A62 * this._k2[i] + A63 * this._k3[i] + A64 * this._k4[i] + A65 * this._k5[i]);
        this._evalRhs(t + C6 * h, this._yTry, this._k6);

        // 5th-order solution → _yTry; embedded error → _yErr.
        let errSup = 0;
        for (let i = 0; i < n; i++) {
            this._yTry[i] = this._y[i] + h * (B1 * this._k1[i] + B3 * this._k3[i] + B4 * this._k4[i] + B6 * this._k6[i]);
            const errLocal = h * (E1 * this._k1[i] + E3 * this._k3[i] + E4 * this._k4[i] + E5 * this._k5[i] + E6 * this._k6[i]);
            this._yErr[i] = errLocal;
            // Normalise error per Numerical Recipes: scale = atol +
            // rtol * max(|y_i|, |yTry_i|). We collapse atol == rtol ==
            // tolerance for simplicity; configurable later if needed.
            const scale = this._tolerance + this._tolerance * Math.max(Math.abs(this._y[i]), Math.abs(this._yTry[i]));
            const ratio = Math.abs(errLocal) / scale;
            if (ratio > errSup) errSup = ratio;
        }
        return errSup;
    }

    /**
     * Evaluate the full rhs vector at (t, y) by walking every leaf and
     * calling its `rhs(t, y, offset, inputs, dydt)`. `dydt` is the
     * caller-supplied scratch buffer (k1 / k2 / ...). Inputs come from
     * the per-leaf cached snapshot — see `_snapshotInputs`.
     */
    private _evalRhs(t: number, y: Float64Array, dydt: Float64Array): void {
        for (let i = 0; i < this._leaves.length; i++) {
            this._leaves[i].rhs(t, y, this._offsets[i], this._inputs[i], dydt);
        }
    }

    /**
     * Build the per-leaf `IIntegrationInputs` snapshot from the
     * session's SIGNAL store. Signals are continuous values held by
     * the destination's `inputSignals` map; reading them is
     * non-destructive (ZOH semantic). The snapshot is held constant
     * across all micro-steps of one macro-step (per Q1.2 resolution
     * in the v2 plan) so the embedded error estimator sees a
     * deterministic `rhs(t, y, inputs)`.
     *
     * Stream-kind channels are silently ignored here — they would
     * require consume() which is the leaf's responsibility in its
     * fire(). A well-designed IIntegrable node declares its rhs
     * inputs as `kind: "signal"`; mixing rhs inputs with stream-kind
     * ports is unsupported and yields undefined at the snapshot level.
     *
     * The snapshot is keyed by the DEST slot name so `inputs.get("V")`
     * in the leaf's `rhs` works as written.
     */
    private _snapshotInputs(session: ISession): void {
        const links = session.graph.links as ReadonlyArray<IChannel>;
        for (let i = 0; i < this._leaves.length; i++) {
            const leaf = this._leaves[i] as unknown as IRuntimeNode;
            const snapshot = this._inputs[i];
            snapshot.clear();
            for (const link of leaf.opsc<IChannel>()) {
                if (!link.enabled) continue;
                const idx = links.indexOf(link);
                if (idx < 0) continue;
                // Read via signal API. Returns undefined for stream
                // channels OR for signal channels that have not been
                // published yet — `rhs` falls back to its own default
                // (typically 0) when inputs.get(slot) returns undefined.
                const value = session.readSignal(idx);
                if (typeof value !== "number") continue;
                const slot = String(link.toSlot ?? link.slot);
                snapshot.set(slot, value);
            }
        }
    }
}
