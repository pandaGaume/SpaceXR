// ═══════════════════════════════════════════════════════════════════════════
// RnnRunnerBuilder : builds a NeuralRunner backed by an RnnInferenceRuntime.
//
// Each fire() of the NeuralRunner consumes one input vector and advances
// the RNN by exactly one timestep (.step). Hidden / cell state persists
// across fire() calls, so a session's tick loop naturally drives a
// sequence forward. Reset via `runner.runtime.resetState()` between
// independent sequences.
// ═══════════════════════════════════════════════════════════════════════════

import { NeuralRunner } from "../nn.runner";
import { NeuralRunnerBuilder } from "../nn.runner.builder";
import { RnnInferenceRuntime } from "./rnn.inference";
import { IRnnGraph } from "./rnn.interfaces";
import type { IActivationFunction } from "../ann/mlp/mlp.interfaces";

export class RnnRunnerBuilder extends NeuralRunnerBuilder<IRnnGraph, RnnInferenceRuntime> {
    private _outputActivation?: IActivationFunction;

    /**
     * Sets the activation applied at the output layer. Optional; the
     * RnnInferenceRuntime uses its own default when undefined.
     */
    public withOutputActivation(fn: IActivationFunction): this {
        this._outputActivation = fn;
        return this;
    }

    public override build(): NeuralRunner<RnnInferenceRuntime> {
        if (!this._graph) {
            throw new Error("RnnRunnerBuilder: withGraph(...) is required before build()");
        }
        const runtime = new RnnInferenceRuntime(this._graph, this._outputActivation);
        return new NeuralRunner(runtime, (rt, input) => rt.step(input));
    }
}
