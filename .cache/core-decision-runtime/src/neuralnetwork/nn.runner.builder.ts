// ═══════════════════════════════════════════════════════════════════════════
// NeuralRunnerBuilder<G> : abstract base for fluent NeuralRunner construction
//
// Common shape for the family-specific builders (MlpRunnerBuilder,
// CnnRunnerBuilder, RnnRunnerBuilder). Holds the typed graph reference and
// the optional input/output slot declarations; subclasses add family
// options (activation, etc.) and implement build() to instantiate the
// matching inference runtime.
//
// Matches the existing core/graph builder pattern (GraphBuilder<N, L>,
// LinkBuilder, GraphNodeBuilder): typed parameterised builder with fluent
// withXxx methods returning `this`, terminal build() returning the
// constructed object.
// ═══════════════════════════════════════════════════════════════════════════

import { IGraph } from "../graph/graph.interfaces";
import { INeuron, ISynapse } from "./nn.interfaces";
import { NeuralRunner } from "./nn.runner";

export abstract class NeuralRunnerBuilder<G extends IGraph<INeuron, ISynapse>, R = unknown> {
    protected _graph?: G;
    protected _inputSlots: Array<string | number> = [];
    protected _outputSlots: Array<string | number> = [];

    public withGraph(g: G): this {
        this._graph = g;
        return this;
    }

    public withInputSlots(slots: ReadonlyArray<string | number>): this {
        this._inputSlots = [...slots];
        return this;
    }

    public withOutputSlots(slots: ReadonlyArray<string | number>): this {
        this._outputSlots = [...slots];
        return this;
    }

    /**
     * Build the configured NeuralRunner. Subclasses instantiate the
     * family-specific inference runtime and wire the evaluate closure;
     * the R generic narrows the runtime type returned (e.g.
     * MLPInferenceRuntime for MlpRunnerBuilder).
     */
    public abstract build(): NeuralRunner<R>;
}
