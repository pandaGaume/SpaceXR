// ═══════════════════════════════════════════════════════════════════════════
// Generic weight quantizer.
//
// Pure math + memory packing on Float32Array buffers. Knows nothing
// about neural-network families : the same primitives apply to Conv
// kernels, MLP synapses, attention projections, RNN gate weights,
// even non-ML use cases (signal processing constants, lookup tables).
//
// Family-specific marshalling (e.g. walking IConvKernel[] in OIHW
// order, or stitching synapse weights into a [units, prev_size]
// matrix) lives in each family's `quantization/` subdirectory and
// produces a Float32Array that is handed to one of the methods here.
//
// Conventions :
//   - Weights default to symmetric quantization (zero_point = 0).
//     The int8 grid covers [-127, 127]; -128 is reserved as a guard
//     slot to match CyanMycelium's `cm_quant_prep_qs8` convention.
//   - Per-channel symmetric uses `absMax` per slice along `axis`
//     (typically axis = 0 for output filters / output features).
//   - Asymmetric per-tensor exists for completeness (rare for
//     weights, common for activations — but the calibration path
//     handles activation params already).
// ═══════════════════════════════════════════════════════════════════════════

import { asymmetricParamsFromRange, dtypeBounds, roundHalfEven } from "./quantization.math";

// ─── Output type ─────────────────────────────────────────────────────────

export interface QuantizedBuffer {
    /** int8 packed in the same shape as the input. */
    data: Int8Array;
    /** scales — length 1 for per_tensor, length [shape[axis]] for per_channel. */
    scales: Float32Array;
    /** zero_points — same length as scales; all 0 for symmetric. */
    zeroPoints: Int32Array;
    /** Source shape, copied. */
    shape: number[];
    /** Channel axis used for per_channel; undefined for per_tensor. */
    axis?: number;
    /** True when zero_points are all 0 (informational shortcut for writers). */
    symmetric: boolean;
}

// ─── Internals ───────────────────────────────────────────────────────────

const INT8_HI = 127;
// We use the [-127, 127] grid for symmetric quantization (the -128
// slot is reserved as guard; CyanMycelium follows the same convention
// in cm_quant_prep_qs8 to avoid the asymmetric -128 edge).
const INT8_LO_SYM = -127;

/**
 * Validate that `shape` describes a buffer of length `values.length`.
 * Throws with a helpful message otherwise.
 */
function validateShape(values: Float32Array, shape: ReadonlyArray<number>): void {
    let expected = 1;
    for (const d of shape) expected *= d;
    if (expected !== values.length) {
        throw new Error(`WeightQuantizer: shape [${shape.join(", ")}] implies ${expected} elements, got ${values.length}`);
    }
}

/**
 * Compute the strides for an axis-major walk : (outer, inner) where
 * `outer = prod(shape[..axis-1])` and `inner = prod(shape[axis+1..])`.
 * Used by per-channel quantization to iterate slices.
 */
function axisStrides(shape: ReadonlyArray<number>, axis: number): { outer: number; channels: number; inner: number } {
    if (axis < 0 || axis >= shape.length) {
        throw new Error(`WeightQuantizer: axis ${axis} out of range for shape [${shape.join(", ")}]`);
    }
    let outer = 1;
    let inner = 1;
    for (let i = 0; i < axis; i++) outer *= shape[i];
    for (let i = axis + 1; i < shape.length; i++) inner *= shape[i];
    return { outer, channels: shape[axis], inner };
}

/**
 * Quantize one float scalar with symmetric semantics. Centralised so
 * every primitive uses the same rounding + saturation.
 */
function quantizeSymmetricScalar(real: number, scale: number): number {
    if (!Number.isFinite(scale) || scale <= 0) return 0;
    let q = roundHalfEven(real / scale);
    if (q > INT8_HI) q = INT8_HI;
    else if (q < INT8_LO_SYM) q = INT8_LO_SYM;
    return q;
}

// ─── Public API ──────────────────────────────────────────────────────────

export class WeightQuantizer {
    /**
     * Per-tensor symmetric int8 quantization. One global scale derived
     * from `max(abs(values))`. zero_point = 0. Default choice for
     * Dense / MLP / matmul weight matrices and any tensor where
     * per-channel granularity isn't justified.
     *
     * Behaviour on an all-zero buffer : scale falls back to `1/127`
     * so we don't divide by zero; every quantized value becomes 0,
     * which is the correct round-trip (0 * scale = 0).
     */
    public static perTensorSymmetric(values: Float32Array, shape: ReadonlyArray<number>): QuantizedBuffer {
        validateShape(values, shape);
        let absMax = 0;
        for (let i = 0; i < values.length; i++) {
            const a = Math.abs(values[i]);
            if (a > absMax) absMax = a;
        }
        const scale = absMax > 0 ? absMax / INT8_HI : 1 / INT8_HI;
        const data = new Int8Array(values.length);
        for (let i = 0; i < values.length; i++) {
            data[i] = quantizeSymmetricScalar(values[i], scale);
        }
        return {
            data,
            scales: Float32Array.from([scale]),
            zeroPoints: Int32Array.from([0]),
            shape: [...shape],
            symmetric: true,
        };
    }

    /**
     * Per-channel symmetric int8 quantization. One scale per slice
     * along `axis` (typically the output-filter / output-feature
     * axis). zero_points all 0. Standard choice for Conv kernels in
     * NCHW / OIHW layout, where per-filter granularity improves
     * accuracy when filters have very different magnitudes.
     */
    public static perChannelSymmetric(values: Float32Array, shape: ReadonlyArray<number>, axis: number): QuantizedBuffer {
        validateShape(values, shape);
        const { outer, channels, inner } = axisStrides(shape, axis);
        const scales = new Float32Array(channels);
        // 1. absMax per channel.
        for (let c = 0; c < channels; c++) {
            let absMax = 0;
            for (let o = 0; o < outer; o++) {
                const base = (o * channels + c) * inner;
                for (let i = 0; i < inner; i++) {
                    const a = Math.abs(values[base + i]);
                    if (a > absMax) absMax = a;
                }
            }
            scales[c] = absMax > 0 ? absMax / INT8_HI : 1 / INT8_HI;
        }
        // 2. Quantize.
        const data = new Int8Array(values.length);
        for (let o = 0; o < outer; o++) {
            for (let c = 0; c < channels; c++) {
                const s = scales[c];
                const base = (o * channels + c) * inner;
                for (let i = 0; i < inner; i++) {
                    data[base + i] = quantizeSymmetricScalar(values[base + i], s);
                }
            }
        }
        return {
            data,
            scales,
            zeroPoints: new Int32Array(channels), // zero-initialised
            shape: [...shape],
            axis,
            symmetric: true,
        };
    }

    /**
     * Per-tensor asymmetric int8 quantization. Rare for weights, but
     * useful for embedding tables / lookup constants whose value
     * distribution is one-sided. Internally uses
     * `asymmetricParamsFromRange` so the integer grid keeps real 0
     * representable.
     */
    public static perTensorAsymmetric(values: Float32Array, shape: ReadonlyArray<number>): QuantizedBuffer {
        validateShape(values, shape);
        let min = Infinity;
        let max = -Infinity;
        for (let i = 0; i < values.length; i++) {
            const v = values[i];
            if (v < min) min = v;
            if (v > max) max = v;
        }
        if (!Number.isFinite(min)) {
            min = 0;
            max = 0;
        }
        const { scale, zeroPoint } = asymmetricParamsFromRange(min, max, "int8");
        const { lo, hi } = dtypeBounds("int8");
        const data = new Int8Array(values.length);
        for (let i = 0; i < values.length; i++) {
            let q = roundHalfEven(values[i] / scale) + zeroPoint;
            if (q > hi) q = hi;
            else if (q < lo) q = lo;
            data[i] = q;
        }
        return {
            data,
            scales: Float32Array.from([scale]),
            zeroPoints: Int32Array.from([zeroPoint]),
            shape: [...shape],
            symmetric: zeroPoint === 0,
        };
    }

    /**
     * Convenience : reverse a QuantizedBuffer back to FP32 for
     * round-trip validation / debugging. Always returns FP32, never
     * mutates the input.
     */
    public static dequantize(q: QuantizedBuffer): Float32Array {
        const out = new Float32Array(q.data.length);
        if (q.axis === undefined) {
            const s = q.scales[0];
            const zp = q.zeroPoints[0];
            for (let i = 0; i < q.data.length; i++) {
                out[i] = (q.data[i] - zp) * s;
            }
        } else {
            const { outer, channels, inner } = axisStrides(q.shape, q.axis);
            for (let o = 0; o < outer; o++) {
                for (let c = 0; c < channels; c++) {
                    const s = q.scales[c];
                    const zp = q.zeroPoints[c];
                    const base = (o * channels + c) * inner;
                    for (let i = 0; i < inner; i++) {
                        out[base + i] = (q.data[base + i] - zp) * s;
                    }
                }
            }
        }
        return out;
    }
}
