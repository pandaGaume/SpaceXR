// ═══════════════════════════════════════════════════════════════════════════
// Calibration : collect activation statistics by running the FP32
// graph over a representative sample set, then produce per-tensor
// quantization parameters (asymmetric, per_tensor) for activations.
//
// Convention follows CyanMycelium : activations are quantized
// asymmetrically per-tensor; weights are handled separately by
// WeightQuantizer (symmetric per-channel for Conv, per-tensor for
// Dense).
//
// The runner is explicit : the caller invokes `observe(samples)` with
// a fixed list of named-input maps; no implicit monkey-patching of
// Kernel.fire. We rely on the fact that `Kernel._publishOutputs`
// stashes each kernel's outputs onto `bag.lastOutputs`, which is the
// same channel `ComputeGraph._collectResults` uses to gather sink
// outputs — so reading from the bag after each run gives us a clean
// snapshot of every intermediate tensor.
// ═══════════════════════════════════════════════════════════════════════════

import type { ComputeGraph, IKernel, IKernelBag, ITensor } from "../compute";
import { asymmetricParamsFromRange } from "./quantization.math";
import type { IQuantizationParams, QuantDType } from "./quantization.interfaces";

// ─── Strategy ────────────────────────────────────────────────────────────

/**
 * A calibration strategy accumulates statistics from observed
 * tensors and synthesizes quantization parameters at finalize time.
 * One instance is allocated per (kernel, output-slot) pair.
 */
export interface ICalibrationStrategy {
    /** Fold one observed tensor into the running statistics. */
    update(tensor: ITensor): void;

    /** Synthesize the final IQuantizationParams from accumulated
     *  statistics. The dtype dictates the quantization grid. */
    finalize(dtype: QuantDType): IQuantizationParams;

    /** Drop all accumulated statistics so the strategy can be reused. */
    reset(): void;
}

/**
 * Baseline strategy : tracks (min, max) of the observed float values
 * and emits asymmetric per-tensor parameters via
 * `asymmetricParamsFromRange`. Cheap, no histogram, good enough for
 * most well-behaved activations; replace with a percentile-based
 * strategy when outliers distort the range.
 */
export class MinMaxStrategy implements ICalibrationStrategy {
    private _min = Infinity;
    private _max = -Infinity;
    private _count = 0;

    public update(tensor: ITensor): void {
        const data = tensor.data;
        let mn = this._min;
        let mx = this._max;
        for (let i = 0; i < data.length; i++) {
            const v = data[i];
            if (v < mn) mn = v;
            if (v > mx) mx = v;
        }
        this._min = mn;
        this._max = mx;
        this._count += data.length;
    }

    public finalize(dtype: QuantDType): IQuantizationParams {
        // No observations yet: pretend we saw the constant 0.
        const min = Number.isFinite(this._min) ? this._min : 0;
        const max = Number.isFinite(this._max) ? this._max : 0;
        const { scale, zeroPoint } = asymmetricParamsFromRange(min, max, dtype);
        return {
            scheme: "per_tensor",
            dtype,
            scales: Float32Array.from([scale]),
            zeroPoints: Int32Array.from([zeroPoint]),
            symmetric: false,
        };
    }

    public reset(): void {
        this._min = Infinity;
        this._max = -Infinity;
        this._count = 0;
    }

    /** Diagnostics: observed range and sample count. */
    public get min(): number {
        return this._min;
    }
    public get max(): number {
        return this._max;
    }
    public get count(): number {
        return this._count;
    }
}

// ─── Runner ──────────────────────────────────────────────────────────────

/**
 * Drives a compute graph over a series of calibration samples,
 * accumulating per-output statistics with a fresh strategy instance
 * per (kernel, slot) pair.
 *
 * Typical usage:
 * ```typescript
 * const runner = new CalibrationRunner(graph);
 * runner.observe([{ accel_window: window1 }, { accel_window: window2 }, ...]);
 * const params = runner.getActivationParams();
 * const inputParams = runner.getInputParams();
 * ```
 */
export class CalibrationRunner {
    private readonly _graph: ComputeGraph;
    private readonly _strategyFactory: () => ICalibrationStrategy;
    private readonly _dtype: QuantDType;
    private readonly _kernelStrategies = new Map<IKernel, ICalibrationStrategy[]>();
    private readonly _inputStrategies = new Map<string, ICalibrationStrategy>();
    private _runs = 0;

    public constructor(graph: ComputeGraph, strategyFactory: () => ICalibrationStrategy = () => new MinMaxStrategy(), dtype: QuantDType = "int8") {
        this._graph = graph;
        this._strategyFactory = strategyFactory;
        this._dtype = dtype;
    }

    /**
     * Run the graph once per sample, observing every kernel's
     * outputs as well as the named graph inputs. Existing
     * accumulated statistics are preserved; call `reset()` between
     * independent calibration sessions.
     */
    public observe(samples: Map<string, ITensor>[]): void {
        for (const sample of samples) {
            // 1. Observe graph inputs.
            for (const [name, tensor] of sample) {
                let s = this._inputStrategies.get(name);
                if (!s) {
                    s = this._strategyFactory();
                    this._inputStrategies.set(name, s);
                }
                s.update(tensor);
            }

            // 2. Run inference. Result map is discarded; we read
            //    intermediate outputs through bag.lastOutputs.
            this._graph.infer(sample);

            // 3. Observe each kernel's outputs.
            for (const node of this._graph.nodes as ReadonlyArray<IKernel>) {
                const bag = node.bag as IKernelBag | undefined;
                const outputs = bag?.lastOutputs;
                if (!outputs || outputs.length === 0) continue;
                let strategies = this._kernelStrategies.get(node);
                if (!strategies) {
                    strategies = outputs.map(() => this._strategyFactory());
                    this._kernelStrategies.set(node, strategies);
                }
                // Defensive: if a kernel produced fewer outputs than
                // expected, only update the slots present.
                for (let i = 0; i < outputs.length && i < strategies.length; i++) {
                    strategies[i].update(outputs[i]);
                }
            }
            this._runs++;
        }
    }

    /**
     * Per-kernel quantization parameters, one entry per output slot.
     * Only kernels observed at least once appear in the map.
     */
    public getActivationParams(): Map<IKernel, IQuantizationParams[]> {
        const out = new Map<IKernel, IQuantizationParams[]>();
        for (const [kernel, strategies] of this._kernelStrategies) {
            out.set(
                kernel,
                strategies.map((s) => s.finalize(this._dtype))
            );
        }
        return out;
    }

    /**
     * Quantization parameters per graph-input name (the names from
     * the `samples` maps), describing how to quantize the FP32
     * tensors that enter the graph at runtime.
     */
    public getInputParams(): Map<string, IQuantizationParams> {
        const out = new Map<string, IQuantizationParams>();
        for (const [name, strategy] of this._inputStrategies) {
            out.set(name, strategy.finalize(this._dtype));
        }
        return out;
    }

    /** Number of samples observed so far. */
    public get runs(): number {
        return this._runs;
    }

    /**
     * Drop all accumulated statistics so the runner can be re-used
     * for a fresh calibration session.
     */
    public reset(): void {
        for (const strategies of this._kernelStrategies.values()) {
            for (const s of strategies) s.reset();
        }
        for (const s of this._inputStrategies.values()) s.reset();
        this._runs = 0;
    }
}
