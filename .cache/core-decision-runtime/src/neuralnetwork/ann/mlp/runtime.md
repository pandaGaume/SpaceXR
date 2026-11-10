# Modular MLP Inference Runtime

This module defines a flexible and efficient architecture for executing inference on Multi-Layer Perceptron (MLP) graphs using a node-link model. It separates structural definitions (neurons, synapses) from runtime execution (forward pass, context management).

## Key Concepts

### Structural Interfaces

- **`IMlpNeuron`**  
  Represents a neuron in an MLP. Includes static parameters like:
  - `bias`: the additive bias before activation
  - `activationFn`: an optional custom activation function

- **`IMlpSynapse`**  
  Represents a weighted connection between neurons. Also supports optional training-related fields:
  - `gradient?`, `weightDelta?`, `velocity?`

- **`IMlpGraph`**  
  Extends a generic `IGraph<N, L>` with typed `IMlpNeuron` and `IMlpSynapse` collections.

### Runtime Contexts

Runtime state is held in a per-neuron field called `bag`. This avoids polluting the structural interfaces with transient values.

- **`InferenceContext`**
  ```ts
  interface InferenceContext {
      sum: number;
      activation: number;
      remainingInputs: number;
      totalInputs: number;
  }
  ```

- **`BackpropContext`** (extends `InferenceContext`)
  ```ts
  interface BackpropContext extends InferenceContext {
      error: number;
      gradient?: number;
  }
  ```

These contexts are initialized once per neuron and reused across inference runs.

### Design Highlights

- `bag` is stored directly on each `INeuron`, but only contains ephemeral runtime data.
- No allocation of intermediate data structures like `Map` or `indexOf()` lookups.
- Input neurons are seeded with values and the network processes activations in topological order using a queue.
- Activation functions are customizable per neuron, with `ReLU` as default.
- The `remainingInputs` and `totalInputs` counters allow fast forward-pass scheduling without scanning input links at runtime.

## Inference Engine (`MLPRuntime`)

The runtime provides a `run()` method to execute forward inference:

```ts
const runtime = new MLPRuntime(graph);
const outputs = runtime.run([0.2, -0.4, 0.8]);
```

### Initialization Optimization

A utility method `_resetInferenceContext(neuron)` ensures fast reinitialization between runs:

```ts
private _resetInferenceContext(neuron: IMlpNeuron): void {
    if (!neuron.bag) {
        const numInputs = neuron.opsc<IMlpSynapse>()?.length ?? 0;
        neuron.bag = { sum: 0, activation: 0, remainingInputs: numInputs, totalInputs: numInputs };
    } else {
        const bag = neuron.bag as InferenceContext;
        bag.sum = 0;
        bag.activation = 0;
        bag.remainingInputs = bag.totalInputs;
    }
}
```

## Design Philosophy

This architecture emphasizes:
- Clean separation between **model structure** and **runtime execution**
- High performance with zero allocations during execution
- Flexibility to plug in additional logic like training, visualization, or custom behavior