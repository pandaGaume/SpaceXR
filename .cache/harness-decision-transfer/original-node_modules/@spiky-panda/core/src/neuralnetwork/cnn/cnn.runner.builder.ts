// ═══════════════════════════════════════════════════════════════════════════
// CnnRunnerBuilder : builds a NeuralRunner backed by a CnnInferenceRuntime.
// ═══════════════════════════════════════════════════════════════════════════

import { NeuralRunner } from "../nn.runner";
import { NeuralRunnerBuilder } from "../nn.runner.builder";
import { CnnInferenceRuntime } from "./cnn.inference";
import { ICnnGraph } from "./cnn.interfaces";
import type { IActivationFunction } from "../ann/mlp/mlp.interfaces";
import { ActivationFunctions } from "../ann/mlp/mlp.activation";

export class CnnRunnerBuilder extends NeuralRunnerBuilder<ICnnGraph, CnnInferenceRuntime> {
    private _mainActivation: IActivationFunction = ActivationFunctions.relu;

    /**
     * Sets the main activation function applied to conv/dense neurons
     * without a per-neuron activationFn override. Defaults to ReLU.
     */
    public withActivation(fn: IActivationFunction): this {
        this._mainActivation = fn;
        return this;
    }

    public override build(): NeuralRunner<CnnInferenceRuntime> {
        if (!this._graph) {
            throw new Error("CnnRunnerBuilder: withGraph(...) is required before build()");
        }
        const runtime = new CnnInferenceRuntime(this._graph, this._mainActivation);
        return new NeuralRunner(runtime, (rt, input) => rt.run(input));
    }
}
