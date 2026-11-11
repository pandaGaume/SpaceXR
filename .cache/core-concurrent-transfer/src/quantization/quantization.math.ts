// ═══════════════════════════════════════════════════════════════════════════
// Quantization math primitives.
//
// All routines use banker's rounding (round-half-to-even) for parity
// with CyanMycelium's `nearbyintf(FE_TONEAREST)` and with NumPy /
// ONNX reference implementations. The same rounding policy must be
// used everywhere — calibration, weight quantizer, fake-quant TS ops
// — otherwise we accumulate sub-LSB drift between paths.
// ═══════════════════════════════════════════════════════════════════════════

import type { ITensor } from "../compute/compute.interfaces";
import type { IQuantizationParams, IQuantizedTensor, QuantDType } from "./quantization.interfaces";

// ─── Rounding ────────────────────────────────────────────────────────────

/**
 * Round-half-to-even (banker's rounding): values exactly halfway
 * between two integers round to the nearest even integer. Same
 * tie-breaking rule as `Math.round` in IEEE-754 round-to-nearest-even
 * mode, but JavaScript's `Math.round` rounds .5 toward +Inf, so we
 * implement the even rule explicitly.
 */
export function roundHalfEven(x: number): number {
    if (!Number.isFinite(x)) return x;
    const floor = Math.floor(x);
    const diff = x - floor;
    if (diff < 0.5) return floor;
    if (diff > 0.5) return floor + 1;
    // Exactly halfway → round to the even neighbour.
    return floor % 2 === 0 ? floor : floor + 1;
}

// ─── Domain bounds ───────────────────────────────────────────────────────

/** Inclusive low / high bounds for an int8 or uint8 quantized value. */
export function dtypeBounds(dtype: QuantDType): { lo: number; hi: number } {
    return dtype === "int8" ? { lo: -128, hi: 127 } : { lo: 0, hi: 255 };
}

// ─── Scalar quantize / dequantize ────────────────────────────────────────

/**
 * Quantize one floating-point value to an integer in the target
 * dtype's range. NaN/Infinity map to the corresponding bound.
 */
export function quantizeScalar(real: number, scale: number, zeroPoint: number, dtype: QuantDType): number {
    const { lo, hi } = dtypeBounds(dtype);
    if (scale <= 0 || !Number.isFinite(scale)) {
        // Degenerate scale: bucket everything at zero_point.
        return Math.max(lo, Math.min(hi, zeroPoint | 0));
    }
    const q = roundHalfEven(real / scale) + zeroPoint;
    if (q < lo) return lo;
    if (q > hi) return hi;
    return q;
}

/**
 * Dequantize one integer back to a float. Bounds are not enforced —
 * the caller is expected to provide values produced by the matching
 * quantize step (or by an actual int8/uint8 buffer slice).
 */
export function dequantizeScalar(q: number, scale: number, zeroPoint: number): number {
    return (q - zeroPoint) * scale;
}

// ─── Param computation ──────────────────────────────────────────────────

/**
 * Asymmetric per-tensor quantization parameters from a (min, max)
 * activation range. Maps `min` to dtype's `lo`, `max` to `hi`,
 * yielding a `scale` and integer `zero_point` consistent with the
 * ONNX QuantizeLinear spec.
 *
 * Guarantees `scale > 0` even for degenerate (min === max) inputs by
 * falling back to a unit scale (the affected tensor is constant; any
 * non-zero scale dequantizes back to the same float value).
 */
export function asymmetricParamsFromRange(min: number, max: number, dtype: QuantDType): { scale: number; zeroPoint: number } {
    const { lo, hi } = dtypeBounds(dtype);
    // Always include 0 in the representable range; ONNX requires this
    // so that real zero quantizes exactly (no rounding error on zero
    // activations).
    const lo_r = Math.min(min, 0);
    const hi_r = Math.max(max, 0);
    let scale: number;
    if (hi_r > lo_r) {
        scale = (hi_r - lo_r) / (hi - lo);
    } else {
        scale = 1; // degenerate constant tensor
    }
    // zero_point picks the integer that maps real 0 onto the integer
    // grid. round_half_even avoids bias.
    const zp = roundHalfEven(lo - lo_r / scale);
    const zeroPoint = Math.max(lo, Math.min(hi, zp));
    return { scale, zeroPoint };
}

/**
 * Symmetric per-tensor quantization parameters from an absolute-max
 * value (commonly used for weights). `zero_point = 0`. For int8 the
 * scale uses [-127, 127] so that the negative bound -128 is left as
 * a guard rail.
 */
export function symmetricParamsFromAbsMax(absMax: number, dtype: QuantDType): { scale: number; zeroPoint: number } {
    if (dtype !== "int8") {
        throw new Error("symmetric quantization is only meaningful for signed int8");
    }
    const range = absMax > 0 ? absMax : 1; // avoid /0 on all-zero tensors
    return { scale: range / 127, zeroPoint: 0 };
}

// ─── Tensor-level helpers ────────────────────────────────────────────────

/**
 * Quantize a Float32 ITensor according to `params`. The result is
 * an Int8Array / Uint8Array packed in the same shape, paired with
 * the input params. Works for per_tensor and per_channel schemes.
 */
export function quantizeTensor(t: ITensor, params: IQuantizationParams): IQuantizedTensor {
    const n = t.data.length;
    const { lo, hi } = dtypeBounds(params.dtype);
    const buf = params.dtype === "int8" ? new Int8Array(n) : new Uint8Array(n);

    if (params.scheme === "per_tensor") {
        const s = params.scales[0];
        const zp = params.zeroPoints[0];
        for (let i = 0; i < n; i++) {
            let q = roundHalfEven(t.data[i] / s) + zp;
            if (q < lo) q = lo;
            else if (q > hi) q = hi;
            buf[i] = q;
        }
    } else {
        // per_channel : the slow axis dictates the (scale, zp) lookup
        const axis = params.axis!;
        const shape = t.shape;
        const C = shape[axis];
        // Stride: how many elements between consecutive slices along
        // the channel axis. For OIHW Conv weights with axis = 0 this
        // is `prod(shape[1..])`; we compute it generically.
        let inner = 1;
        for (let i = axis + 1; i < shape.length; i++) inner *= shape[i];
        const outer = n / (C * inner);
        let idx = 0;
        for (let o = 0; o < outer; o++) {
            for (let c = 0; c < C; c++) {
                const s = params.scales[c];
                const zp = params.zeroPoints[c];
                for (let i = 0; i < inner; i++) {
                    let q = roundHalfEven(t.data[idx] / s) + zp;
                    if (q < lo) q = lo;
                    else if (q > hi) q = hi;
                    buf[idx] = q;
                    idx++;
                }
            }
        }
    }

    return { data: buf, shape: [...t.shape], params, name: t.name };
}

/**
 * Dequantize a quantized tensor back to Float32 ITensor. Useful for
 * fake-quant validation (compare dequantized output against the
 * original FP32 reference) and for ITensor.quantization-decorated
 * intermediates carrying integer-domain floats.
 */
export function dequantizeTensor(qt: IQuantizedTensor): ITensor {
    const n = qt.data.length;
    const out = new Float32Array(n);
    const params = qt.params;

    if (params.scheme === "per_tensor") {
        const s = params.scales[0];
        const zp = params.zeroPoints[0];
        for (let i = 0; i < n; i++) {
            out[i] = (qt.data[i] - zp) * s;
        }
    } else {
        const axis = params.axis!;
        const shape = qt.shape;
        const C = shape[axis];
        let inner = 1;
        for (let i = axis + 1; i < shape.length; i++) inner *= shape[i];
        const outer = n / (C * inner);
        let idx = 0;
        for (let o = 0; o < outer; o++) {
            for (let c = 0; c < C; c++) {
                const s = params.scales[c];
                const zp = params.zeroPoints[c];
                for (let i = 0; i < inner; i++) {
                    out[idx] = (qt.data[idx] - zp) * s;
                    idx++;
                }
            }
        }
    }

    return { data: out, shape: [...qt.shape], name: qt.name };
}

/**
 * Produce a "fake-quant" ITensor: float payload whose values are
 * pre-quantized to the integer grid (round-trip through quantize +
 * dequantize) and tagged with the params metadata. Used by import-
 * side QLinear ops in TS to emit ITensors that look FP32 to the
 * framework but carry integer-valued samples in transit, for
 * downstream consumers that want to verify the int8 numerics.
 */
export function fakeQuantizeTensor(t: ITensor, params: IQuantizationParams): ITensor {
    const q = quantizeTensor(t, params);
    const f = dequantizeTensor(q);
    return { ...f, quantization: params };
}
