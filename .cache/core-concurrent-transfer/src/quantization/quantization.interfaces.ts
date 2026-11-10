// ═══════════════════════════════════════════════════════════════════════════
// Quantization types : params + quantized-tensor representation.
//
// Conventions are aligned with CyanMycelium (the canonical int8 consumer
// for the SpikyPanda toolchain) :
//   - weights are quantized symmetrically (zero_point = 0)
//     * per_channel for Conv (one scale per output filter)
//     * per_tensor  for Dense
//   - activations are quantized asymmetrically, per_tensor only
//     (zero_point ∈ [-128, 127] for int8, [0, 255] for uint8)
//   - quantization formula (banker's rounding):
//         q = round_half_even(real / scale) + zero_point
//         q ∈ [-128, 127] for int8  or  [0, 255] for uint8
//   - dequantization: real = (q - zero_point) * scale
//   - accumulator type is int32 (matmul/conv) — implied at the runtime
//     layer, not stored on these types.
//
// `IQuantizedTensor` lives OUTSIDE the runtime: it is produced by the
// weight quantizer and consumed by the ONNX export emitters and the
// fake-quant TS ops. ITensor in the runtime stays Float32Array; for
// the fake-quant path, ITensor carries an optional `quantization`
// metadata field that points to an IQuantizationParams (the float
// payload then holds integer-valued samples in the int8/uint8 domain).
// ═══════════════════════════════════════════════════════════════════════════

/** Concrete integer type used to store the quantized payload. */
export type QuantDType = "int8" | "uint8";

/**
 * Quantization granularity. `per_tensor` means a single (scale,
 * zero_point) pair; `per_channel` means one pair per slice along
 * `IQuantizationParams.axis`.
 */
export type QuantScheme = "per_tensor" | "per_channel";

/**
 * Quantization parameters describing how to translate between float
 * and integer domains for a given tensor.
 *
 * For `per_tensor`: `scales.length === 1`, `zeroPoints.length === 1`.
 * For `per_channel`: `scales.length === C`, `zeroPoints.length === C`
 *   where `C = shape[axis]`. `symmetric` weights have zeroPoints all 0.
 */
export interface IQuantizationParams {
    readonly scheme: QuantScheme;
    readonly dtype: QuantDType;
    readonly scales: Float32Array;
    readonly zeroPoints: Int32Array;
    /** Channel axis for per_channel; undefined for per_tensor. */
    readonly axis?: number;
    /**
     * When true, zeroPoints are conventionally all 0. The flag is
     * informational (it lets producers / writers skip emitting
     * zero-point initializers when they know symmetry holds) but the
     * actual zeroPoints array remains the source of truth.
     */
    readonly symmetric: boolean;
}

/**
 * An int8 / uint8 tensor with quantization parameters. Never
 * transported through a runtime IChannel; produced offline by
 * `WeightQuantizer` and consumed by ONNX export emitters (as
 * initializers) and by the fake-quant TS validation kernels (as
 * reference data to compare against).
 */
export interface IQuantizedTensor {
    readonly data: Int8Array | Uint8Array;
    readonly shape: number[];
    readonly params: IQuantizationParams;
    readonly name?: string;
}

/**
 * Type guard distinguishing int8 from uint8 storage at runtime.
 * Useful in writers / readers that dispatch on the byte width.
 */
export function isInt8QuantizedTensor(t: IQuantizedTensor): t is IQuantizedTensor & { data: Int8Array } {
    return t.params.dtype === "int8";
}
