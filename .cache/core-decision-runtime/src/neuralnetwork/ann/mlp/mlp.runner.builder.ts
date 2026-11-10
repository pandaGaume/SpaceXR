// ═══════════════════════════════════════════════════════════════════════════
// MlpRunnerBuilder : builds a NeuralRunner backed by an MLPInferenceRuntime.
// ═══════════════════════════════════════════════════════════════════════════

import { NeuralRunner } from "../../nn.runner";
import { NeuralRunnerBuilder } from "../../nn.runner.builder";
import { MLPInferenceRuntime } from "./mlp.inference";
import { IActivationFunction, IMlpGraph } from "./mlp.interfaces";
import { ActivationFunctions } from "./mlp.activation";

export class MlpRunnerBuilder extends NeuralRunnerBuilder<IMlpGraph, MLPInferenceRuntime> {
    private _mainActivation: IActivationFunction = ActivationFunctions.relu;

    /**
     * Sets the main activation function applied to neurons without a
     * per-neuron activationFn override. Defaults to ReLU (matches the
     * MLPInferenceRuntime default).
     */
    public withActivation(fn: IActivationFunction): this {
        this._mainActivation = fn;
        return this;
    }

    public override build(): NeuralRunner<MLPInferenceRuntime> {
        if (!this._graph) {
            throw new Error("MlpRunnerBuilder: withGraph(...) is required before build()");
        }
        const runtime = new MLPInferenceRuntime(this._graph, this._mainActivation);
        return new NeuralRunner(runtime, (rt, input) => rt.run(input));
    }
}
