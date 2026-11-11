// ═══════════════════════════════════════════════════════════════════════════
// CNN-side weight marshalling for quantization.
//
// Walks the family-specific weight storage (IConvKernel for Conv,
// ICnnSynapse for Dense) and produces flat Float32Array buffers in
// the canonical layout downstream consumers expect (OIHW for Conv
// kernels in CyanMycelium / ONNX, [units, prev_size] for Dense
// matmul). Then dispatches to the generic WeightQuantizer in
// core/quantization.
//
// This layer is the only CNN-specific quantization code; the rest
// (math, parameter computation, layout-agnostic int8 packing) lives
// in core/quantization. The same pattern applies to MLP / RNN /
// Transformer when their time comes — each family writes its own
// marshaller.
// ═══════════════════════════════════════════════════════════════════════════

import { QuantizedBuffer, WeightQuantizer } from "../../../quantization";
import type { ICnnLayerDescriptor, ICnnNeuron, ICnnSynapse, IConvKernel } from "../cnn.interfaces";

// ─── Conv layer ──────────────────────────────────────────────────────────

/**
 * Pack a Conv layer's shared kernels into a Float32Array in OIHW
 * order : `[F, C_in, kH, kW]`. Each kernel stores its weights as
 * `(channel, row, col)` row-major; this routine repacks them to the
 * NCHW filter layout that ONNX QLinearConv (and CyanMycelium) expect.
 */
export function extractConvLayerWeights(kernels: ReadonlyArray<IConvKernel>, inputChannels: number): { data: Float32Array; shape: [number, number, number, number] } {
    if (kernels.length === 0) {
        throw new Error("extractConvLayerWeights: empty kernel list");
    }
    const k0 = kernels[0];
    const kH = k0.height;
    const kW = k0.width;
    const F = kernels.length;
    const data = new Float32Array(F * inputChannels * kH * kW);
    for (let f = 0; f < F; f++) {
        const k = kernels[f];
        if (k.height !== kH || k.width !== kW) {
            throw new Error(`extractConvLayerWeights: kernel ${f} shape (${k.height}, ${k.width}) ` + `differs from kernel 0 (${kH}, ${kW})`);
        }
        for (let ic = 0; ic < inputChannels; ic++) {
            for (let kr = 0; kr < kH; kr++) {
                for (let kc = 0; kc < kW; kc++) {
                    const src = ic * kH * kW + kr * kW + kc;
                    const dst = ((f * inputChannels + ic) * kH + kr) * kW + kc;
                    data[dst] = k.weights[src];
                }
            }
        }
    }
    return { data, shape: [F, inputChannels, kH, kW] };
}

/**
 * Quantize a Conv layer with per-channel symmetric scheme : one
 * scale per output filter (axis = 0). zero_points all 0. Returns the
 * int8 buffer in OIHW layout plus the scales[F] array. Bias is left
 * FP32 — the ONNX exporter scales it to int32 at emit time using
 * `(input_scale * weight_scales[f])`.
 */
export function quantizeConvLayer(kernels: ReadonlyArray<IConvKernel>, inputChannels: number): { quantized: QuantizedBuffer; biases: Float32Array } {
    const { data, shape } = extractConvLayerWeights(kernels, inputChannels);
    const quantized = WeightQuantizer.perChannelSymmetric(data, shape, /* axis = */ 0);
    const biases = new Float32Array(kernels.length);
    for (let f = 0; f < kernels.length; f++) biases[f] = kernels[f].bias;
    return { quantized, biases };
}

// ─── Dense layer ─────────────────────────────────────────────────────────

/**
 * Walk a Dense layer's synapses and pack the weight matrix in
 * `[units, prev_size]` row-major order. Each output neuron is one
 * row; each input neuron from the previous layer is one column. The
 * row order matches `denseDesc.neurons`; the column order matches
 * `prevDesc.neurons`. Missing synapses (which shouldn't happen in a
 * well-formed dense layer) leave the corresponding weight at 0.
 */
export function extractDenseLayerWeights(denseDesc: ICnnLayerDescriptor, prevDesc: ICnnLayerDescriptor): { data: Float32Array; shape: [number, number]; biases: Float32Array } {
    const units = denseDesc.neurons.length;
    const prevSize = prevDesc.neurons.length;
    if (units === 0 || prevSize === 0) {
        throw new Error(`extractDenseLayerWeights: empty dense layer (units=${units}, prev=${prevSize})`);
    }
    const data = new Float32Array(units * prevSize);
    const biases = new Float32Array(units);
    const prevIdx = new Map<ICnnNeuron, number>();
    prevDesc.neurons.forEach((n, k) => prevIdx.set(n, k));

    for (let u = 0; u < units; u++) {
        const neuron = denseDesc.neurons[u];
        biases[u] = neuron.bias;
        const incoming = neuron.opsc<ICnnSynapse>();
        for (const syn of incoming) {
            const src = syn.oini as ICnnNeuron | null;
            if (!src) continue;
            const j = prevIdx.get(src);
            if (j === undefined) {
                throw new Error(`extractDenseLayerWeights: synapse for output neuron ${u} ` + `references a source neuron not present in the previous layer`);
            }
            data[u * prevSize + j] = syn.weight;
        }
    }
    return { data, shape: [units, prevSize], biases };
}

/**
 * Quantize a Dense layer with per-tensor symmetric scheme : a single
 * scale derived from `max(abs(W))` over the whole matrix. zp = 0.
 * Returns the int8 matrix plus its (scalar) scale.
 *
 * This matches CyanMycelium's QLinearMatMul which only supports per-
 * tensor scales for both operands.
 */
export function quantizeDenseLayer(denseDesc: ICnnLayerDescriptor, prevDesc: ICnnLayerDescriptor): { quantized: QuantizedBuffer; biases: Float32Array } {
    const { data, shape, biases } = extractDenseLayerWeights(denseDesc, prevDesc);
    const quantized = WeightQuantizer.perTensorSymmetric(data, shape);
    return { quantized, biases };
}
