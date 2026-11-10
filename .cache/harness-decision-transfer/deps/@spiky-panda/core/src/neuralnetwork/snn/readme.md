# Spiking Neural Networks (SNN)

Spiking Neural Networks (SNN) are inspired by the biological behavior of real neurons. Instead of using continuous activation values, they transmit information through discrete events called spikes.

SNNs operate over time, with neuron states evolving dynamically. They can model temporal patterns and are well-suited for low-power and event-driven computing, especially on neuromorphic hardware.

Their training often relies on techniques such as spike-timing-dependent plasticity (STDP) or surrogate gradients.

## Interchangeable wave sensor

`WaveSpikeSensorNode` is the boundary between sampled observations and an SNN.
It is a normal runtime node and owns no dynamic state. Its filter history,
crossing history and spike counters are allocated by each `Session`.

```text
timestamped samples
    -> IIR band bank, one or more bands per observation channel
    -> rising and falling phase crossings
    -> one spike port per channel x band x polarity
    -> LIF network
```

Each band declares its center frequency, bandwidth, channel, threshold,
polarity and amplitude encoding. Frequency is represented primarily by spike
timing: rising-to-rising or falling-to-falling intervals give the observed
period. Phase is preserved by distinct rising and falling ports. Optional host
diagnostics include the estimated frequency, phase, peak amplitude and
half-wave energy.

The port descriptor carries the static band map, so an MCU deployment does not
need to repeat frequency metadata in every event. Set `diagnostics: false` and
the runtime spike payload contains only the standard timestamp, amplitude and
source fields.

`WaveSpikeEncoder` is the pure kernel used by the node. Offline training can
run this same encoder directly, while inference runs it through
`WaveSpikeSensorNode` in the graph. This keeps filter coefficients and
phase-crossing rules identical across both paths.

```ts
const sensor = new WaveSpikeSensorNode({
    sampleRateHz: 60,
    bands: [
        {
            id: "ia-envelope-3hz",
            channel: 0,
            centerFrequencyHz: 3,
            bandwidthHz: 1.5,
            threshold: 0.04,
            polarity: "both",
            amplitudeMode: "binary",
        },
    ],
    diagnostics: false,
});
```

For the current MCSA dataset, moving RMS has already removed the 60 Hz carrier.
The useful sensor bands are therefore on the slow 2 to 5 Hz fault envelope.
A future raw ADC pipeline can use the same node with bands on the line
fundamental, harmonics and broken-bar sidebands.

## Constrained LIF training subgraph

`ConstrainedLifSurrogateSubgraph` represents one logical LIF neuron as three
ordinary runtime nodes during training:

```text
weighted spikes -> analytical leak and integration
                -> exact binary threshold
                -> exact hard reset
                -> recurrent membrane state
                              ^
                              |
                    backward-only surrogate derivative
```

Training mode and hard mode execute the same forward equations. A sub-threshold
state emits no event. A threshold crossing emits exactly one spike amplitude,
and the membrane is reset exactly like `LifNeuronNode`. The surrogate is a
compact triangular derivative used only during backpropagation. It is never a
forward value, a transmitted amplitude or a membrane reset coefficient.

The motif is added directly to a dynamic `RuntimeGraph`:

```ts
const teacher = new ConstrainedLifSurrogateSubgraph("hidden-0", {
    threshold: 0.8,
    membraneTimeConstant: 0.02,
    surrogateSlope: 1.25,
    mode: "training",
});

const graph = new RuntimeGraphBuilder<IRuntimeNode, IChannel>()
    .withMode("dynamic")
    .withNodes(source, ...teacher.nodes, sink)
    .withLinks(new SpikeSynapse(source, teacher.inputNode), ...teacher.links, new SpikeSynapse(teacher.outputNode, sink))
    .build();
```

After training, compilation is a real topology rewrite:

```ts
const { neuron } = compileConstrainedLifSubgraph(graph, teacher);
const inference = new Session(graph);
```

The three training nodes and their three internal channels are removed. The
external synapses are reconnected to the new `LifNeuronNode`, and only the LIF
parameters remain. Existing sessions must not be reused after compilation.

The first constrained version deliberately fixes `refractoryPeriod` to zero.
This keeps the training state identical to the compiled LIF. Refractory
dynamics can be added later as a separate, explicitly validated extension.

## Temporal training with BPTT

`ConstrainedLifBpttTrainer` trains the real `SpikeSynapse.weight` values that
enter one constrained teacher. Its analytical tape follows the same
event-driven dynamics as `Session`: an empty timestep does not advance the
membrane, while a delivered event applies analytical leak, integration, the
binary threshold and the hard reset. Backpropagation substitutes only the
undefined threshold derivative with the configured triangular derivative.

```ts
const trainer = new ConstrainedLifBpttTrainer(teacher, [inputA, inputB], {
    learningRate: 0.03,
    timeStep: 0.02,
    lossFunction: LossFunctions.MSE,
    optimizer: Optimizers.Adam(),
});

const samples = [
    {
        inputs: [
            [1, 0],
            [0, 1],
        ],
        targets: [0, 1],
    }, // A then B: spike
    {
        inputs: [
            [0, 1],
            [1, 0],
        ],
        targets: [0, 0],
    }, // B then A: silence
];

const result = trainer.fit(samples, { epochs: 300 });
compileConstrainedLifSubgraph(graph, teacher);
```

`fit` keeps an in-memory checkpoint of the lowest loss observed on the supplied
dataset and restores those weights by default. This focused trainer handles
the immediate incoming synapses of one teacher. Delayed edges and trainable
LIF constants are not silently approximated.

## Acyclic multi-LIF training

`ConstrainedLifNetworkBpttTrainer` extends the same equations to several
teachers in feed-forward topological order. Gradients travel both backward in
time through each membrane and backward through teacher-to-teacher
`SpikeSynapse` connections.

```ts
const trainer = new ConstrainedLifNetworkBpttTrainer(
    {
        neurons: [hiddenA, hiddenB, output],
        inputs: [
            { inputIndex: 0, synapse: input0ToA },
            { inputIndex: 1, synapse: input1ToB },
        ],
        connections: [aToOutput, bToOutput],
        outputs: [output],
    },
    {
        learningRate: 0.02,
        optimizer: Optimizers.Adam(),
    }
);

trainer.fit(dataset, { epochs: 1500 });
compileConstrainedLifNetwork(graph, trainer.network.neurons);
```

For a classifier decoded from activity over the complete sequence, each
training sample can add a runtime-decoder objective:

```ts
const sample = {
    inputs,
    targets,
    runtimeDecoderObjective: {
        targetOutput: classIndex,
        spikeCountScale: 2,
        membranePotentialScale: 1,
        temperature: 2,
        classificationLossWeight: 1,
        temporalLossWeight: 0.25,
    },
};
```

The class score is computed from the same hard values used by native
inference:

```text
score[c] = 2 * sum_t spike[t,c] + finalMembrane[c] / threshold[c]
```

Cross-entropy is applied to these class scores. Its gradient reaches every
binary output-spike decision and the final membrane. The temperature changes
only the loss gradient and does not change the score ordering. No soft value
is propagated during the forward pass.

Network `fit` uses the mean gradient of the supplied sequence batch for one
deterministic Adam update per epoch. This prevents dataset order from deciding
which temporal or spatial pattern dominates a small experiment. The current
network trainer accepts only acyclic, zero-delay inter-neuron connections.
Every teacher keeps its own recurrent membrane state, and every teacher is
still removed one-for-one by `compileConstrainedLifNetwork`.

## Motor-current topology experiment

The grouped BRB sample includes a controlled topology runner that keeps the
historical wave-band encoder fixed and compares a five-class dense baseline,
four BRBi-vs-Healthy specialists, a Healthy/BRB cascade and four cumulative
ordinal heads:

```powershell
npm run experiment:snn-topology -- --full --epochs 40 --batch-size 16
```

The JSON report includes confusion matrices, per-class recall, balanced
accuracy, macro F1, validation-only decision thresholds and exact parameter
counts. The four-head and cascade configurations use approximately the same
total number of trainable weights as the 32-hidden-neuron baseline.
