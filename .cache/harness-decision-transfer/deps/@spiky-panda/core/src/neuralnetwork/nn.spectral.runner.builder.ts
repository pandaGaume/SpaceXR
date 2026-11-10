// ═══════════════════════════════════════════════════════════════════════════
// SpectralRunnerBuilder : builds a NeuralRunner backed by a SpectralInferenceRuntime.
//
// Mirrors MlpRunnerBuilder in shape (fluent withGraph(...) → build() →
// NeuralRunner). It does NOT extend NeuralRunnerBuilder<G, R> because that base
// constrains its link type to `ISynapse` (a scalar `weight`), whereas a
// SpectralSynapse generalizes the weight to a complex per-band transfer and so
// does not carry `weight`. Keeping this standalone avoids weakening the shared
// base's contract for the MLP/CNN/RNN builders.
// ═══════════════════════════════════════════════════════════════════════════

import { NeuralRunner } from "./nn.runner";
import { SpectralInferenceRuntime } from "./nn.spectral.inference";
import { ISpectralGraph } from "./nn.spectral.interfaces";

export class SpectralRunnerBuilder {
    private _graph?: ISpectralGraph;

    public withGraph(g: ISpectralGraph): this {
        this._graph = g;
        return this;
    }

    public build(): NeuralRunner<SpectralInferenceRuntime> {
        if (!this._graph) {
            throw new Error("SpectralRunnerBuilder: withGraph(...) is required before build()");
        }
        const runtime = new SpectralInferenceRuntime(this._graph);
        return new NeuralRunner(runtime, (rt, input) => rt.run(input));
    }
}
