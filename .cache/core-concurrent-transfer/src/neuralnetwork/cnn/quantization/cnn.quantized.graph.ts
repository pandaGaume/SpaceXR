// ═══════════════════════════════════════════════════════════════════════════
// QuantizedCnnGraph : an FP32 CnnGraph + calibration results, pre-
// digested for ONNX export.
//
// Combines:
//   - the FP32 CnnGraph's structural metadata (layer types, sizes,
//     kernel sizes, strides, paddings, pool types, activations);
//   - per-layer activation quantization parameters from calibration
//     (input + each layer's output);
//   - quantized weights and FP32 biases for Conv and Dense layers
//     (via the cnn.weights marshaller).
//
// The resulting structure is what the QuantizedCnnGraphOnnxExporter
// (Phase 7.5) walks to emit QLinearConv / QLinearMatMul /
// QuantizeLinear / DequantizeLinear ops.
//
// Both the outer object and individual layer entries are
// Object.frozen to discourage downstream mutation — the builder is
// a one-shot transform, not a mutable state container.
// ═══════════════════════════════════════════════════════════════════════════

import type { IQuantizationParams, QuantizedBuffer } from "../../../quantization";
import { CnnLayerType, type IActivationFunction, type ICnnGraph, type ICnnLayerDescriptor, type PoolingType } from "../cnn.interfaces";
import { quantizeConvLayer, quantizeDenseLayer } from "./cnn.weights";

// ─── Types ───────────────────────────────────────────────────────────────

/**
 * One layer of a QuantizedCnnGraph. Carries the structural metadata
 * needed to emit ONNX ops + the int8 weights and activation params
 * for Conv / Dense / Pool / MaxPool. Flatten / Input / Reshape /
 * Upsample carry only sizing metadata and the layer's output
 * activation params (which the downstream exporter may use, or skip
 * when the layer is a no-op in int8).
 */
export interface QuantizedCnnLayer {
    readonly type: CnnLayerType;
    readonly width: number;
    readonly height: number;
    readonly channels: number;

    /** Activation params at this layer's OUTPUT. Drives the
     *  QuantizeLinear at the entry boundary (layer index 0) and the
     *  requantize step for Conv/Dense/Pool. */
    readonly outputParams: IQuantizationParams;

    /** Quantized weights (Conv: OIHW per-channel; Dense: per-tensor).
     *  Absent for non-weighted layers (Pool / Flatten / Input / etc.). */
    readonly weights?: QuantizedBuffer;

    /** FP32 bias for Conv / Dense, kept as-is until the ONNX emitter
     *  rescales it to int32 using (input_scale * weight_scale[c]). */
    readonly bias?: Float32Array;

    // ── Spatial metadata (Conv / Pool) ────────────────────────────

    readonly kernelSize?: [number, number];
    readonly stride?: [number, number];
    readonly padding?: [number, number];
    readonly poolType?: PoolingType;

    /** Activation function (Conv / Dense). Read from
     *  `desc.neurons[0].activationFn`. The exporter inserts a Relu
     *  (or no-op for linear) after the QLinear* op. */
    readonly activation?: IActivationFunction;
}

/**
 * The complete quantized representation of a CnnGraph + its
 * calibration. Consumed by the ONNX exporter and by any tooling that
 * wants to dump / inspect the quantized model.
 */
export interface QuantizedCnnGraph {
    readonly source: ICnnGraph;
    readonly layers: ReadonlyArray<QuantizedCnnLayer>;
    /** Quantization params for the CNN's input tensor (before the
     *  first layer's QuantizeLinear). Conceptually identical to
     *  `layers[0].outputParams` when layer 0 is Input (a no-op
     *  layer); kept separate for clarity. */
    readonly inputParams: IQuantizationParams;
}

// ─── Builder ─────────────────────────────────────────────────────────────

export interface QuantizedCnnGraphBuilderOpts {
    /** Quantization params for the CNN's input tensor. */
    inputParams: IQuantizationParams;
    /** Output activation params, one per layer in
     *  `cnn.layerDescriptors`. Index 0 corresponds to the Input
     *  layer (which is a no-op storage layer but still receives
     *  meaningful values from the upstream pipeline). */
    layerOutputParams: ReadonlyArray<IQuantizationParams>;
}

export class QuantizedCnnGraphBuilder {
    /**
     * Build a QuantizedCnnGraph by combining an FP32 CnnGraph with
     * activation params from calibration. Conv / Dense weights are
     * quantized in-place via the cnn.weights marshaller; all other
     * layers contribute only their structural metadata.
     */
    public static fromCalibration(cnn: ICnnGraph, opts: QuantizedCnnGraphBuilderOpts): QuantizedCnnGraph {
        const descs = cnn.layerDescriptors;
        if (opts.layerOutputParams.length !== descs.length) {
            throw new Error(`QuantizedCnnGraphBuilder: layerOutputParams length ${opts.layerOutputParams.length} ` + `does not match cnn.layerDescriptors length ${descs.length}`);
        }

        const layers: QuantizedCnnLayer[] = [];
        let prevDesc: ICnnLayerDescriptor | null = null;
        for (let i = 0; i < descs.length; i++) {
            const desc = descs[i];
            layers.push(QuantizedCnnGraphBuilder._buildLayer(desc, prevDesc, opts.layerOutputParams[i]));
            prevDesc = desc;
        }

        return Object.freeze({
            source: cnn,
            layers: Object.freeze(layers) as ReadonlyArray<QuantizedCnnLayer>,
            inputParams: opts.inputParams,
        });
    }

    private static _buildLayer(desc: ICnnLayerDescriptor, prev: ICnnLayerDescriptor | null, outputParams: IQuantizationParams): QuantizedCnnLayer {
        const layer: {
            -readonly [K in keyof QuantizedCnnLayer]: QuantizedCnnLayer[K];
        } = {
            type: desc.type,
            width: desc.width,
            height: desc.height,
            channels: desc.channels,
            outputParams,
        };

        // Spatial metadata copied verbatim (when present).
        if (desc.kernelSize) layer.kernelSize = [desc.kernelSize[0], desc.kernelSize[1]];
        if (desc.stride) layer.stride = [desc.stride[0], desc.stride[1]];
        if (desc.padding) layer.padding = [desc.padding[0], desc.padding[1]];
        if (desc.poolType !== undefined) layer.poolType = desc.poolType;

        // Activation function : same fn for every neuron in a layer
        // by CnnBuilder construction, so the first neuron suffices.
        const fn = desc.neurons[0]?.activationFn;
        if (fn) layer.activation = fn;

        // Weight quantization for Conv / Dense. Skipped when prev is
        // null (first layer = Input — no weights anyway) or when the
        // required source data is missing.
        switch (desc.type) {
            case CnnLayerType.Conv: {
                if (!desc.convKernels) {
                    throw new Error(
                        `QuantizedCnnGraphBuilder: Conv layer is missing convKernels (the FP32 ` + `CnnGraph was built with a CnnBuilder that didn't populate this field).`
                    );
                }
                if (!prev) {
                    throw new Error("QuantizedCnnGraphBuilder: Conv layer cannot be at index 0");
                }
                const { quantized, biases } = quantizeConvLayer(desc.convKernels, prev.channels);
                layer.weights = quantized;
                layer.bias = biases;
                break;
            }
            case CnnLayerType.Dense: {
                if (!prev) {
                    throw new Error("QuantizedCnnGraphBuilder: Dense layer cannot be at index 0");
                }
                const { quantized, biases } = quantizeDenseLayer(desc, prev);
                layer.weights = quantized;
                layer.bias = biases;
                break;
            }
            default:
                // Pool / Flatten / Input / Upsample / Reshape : no weights.
                break;
        }

        return Object.freeze(layer);
    }
}
