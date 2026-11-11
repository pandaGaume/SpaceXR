// ═══════════════════════════════════════════════════════════════════════════
// CNN-internal calibration helper.
//
// The generic CalibrationRunner observes top-level kernels of a
// ComputeGraph by reading `kernel.bag.lastOutputs`. That works fine
// for kernel-level boundaries, but a CnnInferenceRuntime runs as a
// black box inside its hosting Kernel — its per-layer outputs never
// surface as ITensors. For PTQ we need exactly those per-layer
// activations.
//
// This helper drives `CnnInferenceRuntime.run()` directly, then
// reads each neuron's `bag.activation` to reconstruct the FP32
// output tensor of every layer (Input, Conv, Pool, Flatten, Dense, ...).
// One calibration strategy is allocated per layer. The result is
// formatted to plug straight into `QuantizedCnnGraphBuilder.fromCalibration`.
// ═══════════════════════════════════════════════════════════════════════════

import type { IQuantizationParams, ICalibrationStrategy, QuantDType } from "../../../quantization";
import { MinMaxStrategy } from "../../../quantization";
import type { ICnnGraph, ICnnInferenceContext, ICnnNeuron } from "../cnn.interfaces";
import type { CnnInferenceRuntime } from "../cnn.inference";

/** Snapshot of one layer's FP32 activations after a `runtime.run()` call. */
function snapshotLayer(neurons: ReadonlyArray<ICnnNeuron>): Float32Array {
    const out = new Float32Array(neurons.length);
    for (let i = 0; i < neurons.length; i++) {
        const ctx = neurons[i].bag as ICnnInferenceContext | undefined;
        out[i] = ctx ? ctx.activation : 0;
    }
    return out;
}

export interface CnnLayerCalibrationResult {
    /** Quantization params for the CNN's input tensor (layer 0 output). */
    inputParams: IQuantizationParams;
    /** Output activation params, one per layer in
     *  `cnn.layerDescriptors`. Plug-compatible with
     *  `QuantizedCnnGraphBuilder.fromCalibration`. */
    layerOutputParams: IQuantizationParams[];
}

/**
 * Calibrate every layer of a CnnGraph by running its inference
 * runtime over a representative sample set and observing each
 * neuron's `bag.activation`. The activations are packed into FP32
 * tensors layer-by-layer; one ICalibrationStrategy instance is
 * allocated per layer and finalized at the end.
 *
 * Usage :
 * ```typescript
 * const calib = CnnLayerCalibrationHelper.observe(cnn, runtime, samples);
 * const q = QuantizedCnnGraphBuilder.fromCalibration(cnn, calib);
 * ```
 *
 * `samples` is a flat list of FP32 input vectors in the layout the
 * runtime expects (channel-major flat for the CNN's input layer).
 */
export class CnnLayerCalibrationHelper {
    public static observe(
        cnn: ICnnGraph,
        runtime: CnnInferenceRuntime,
        samples: ReadonlyArray<ReadonlyArray<number>>,
        opts: {
            strategyFactory?: () => ICalibrationStrategy;
            dtype?: QuantDType;
        } = {}
    ): CnnLayerCalibrationResult {
        const strategyFactory = opts.strategyFactory ?? (() => new MinMaxStrategy());
        const dtype = opts.dtype ?? "int8";
        const descs = cnn.layerDescriptors;
        const strategies = descs.map(() => strategyFactory());

        for (const sample of samples) {
            // The runtime accepts a number[] flat input; coerce to
            // the array form whether the caller passed a plain array
            // or a Float32Array slice.
            runtime.run(sample as number[]);
            for (let i = 0; i < descs.length; i++) {
                const tensor = snapshotLayer(descs[i].neurons);
                strategies[i].update({ data: tensor, shape: [tensor.length] });
            }
        }

        const layerOutputParams = strategies.map((s) => s.finalize(dtype));
        return {
            inputParams: layerOutputParams[0],
            layerOutputParams,
        };
    }
}
