# MLP Training Runtime

This module implements training (backpropagation and weight updates) for a Multi-Layer Perceptron (MLP) graph based on the runtime inference engine.

---

## ✅ Components

### `MLPTraining`

A class that orchestrates training steps by:

- Running inference with `MLPRuntime`
- Performing backpropagation to compute gradients
- Applying weight updates using a pluggable `Optimizer`
- Tracking iteration and training context

### `MLPRuntime`

Used by the training runtime to perform the forward pass before starting backpropagation.

---

## 🧠 Backpropagation Logic

The backpropagation works in 3 phases:

1. **Output Layer**
   - Computes the error and delta for each output neuron:

     ```ts
     delta = loss'(output, target) × activationFn'(output)
     ```

2. **Hidden Layers**
   - For each hidden neuron, it sums the weighted deltas of downstream neurons:

     ```ts
     delta = activationFn'(output) × sum(weight × delta_next)
     ```

3. **Synapse Gradient**
   - Each synapse accumulates the gradient:

     ```ts
     gradient = delta_target × activation_source
     ```

---

## 🧩 Contexts

Each neuron and synapse holds a `.bag` object at runtime:

### `IBackpropNeuronContext`

```ts
interface IBackpropNeuronContext {
  activation: number;
  error: number;
  gradient?: number;
}
```

### `IBackpropSynapseContext`

```ts
interface IBackpropSynapseContext {
  gradient: number;
  velocity?: number;
  m?: number;
  v?: number;
  weightDelta?: number;
  prelookedWeight?: number;
}
```

---

## ⚙️ Optimizers

Optimizers are pluggable components that implement:

```ts
interface IOptimizer {
  apply(synapse, learningRate, gradient, context): void;
}
```

Available strategies:

- `SGD`
- `MomentumSGD(momentum)`
- `NAG(momentum)`
- `Adam(beta1, beta2, epsilon)`

---

## 🧮 Activation Functions

Each neuron can define a custom activation function:

```ts
interface IActivationFunction {
  fn: (x: number) => number;
  derivative: (y: number) => number;
}
```

Examples:

- ReLU
- Sigmoid
- Tanh
- Linear

---

## 📦 Next Steps

- Add batch training (accumulate then apply)
- Add learning rate schedulers
- Integrate metrics tracking (loss per epoch)
- Add support for early stopping