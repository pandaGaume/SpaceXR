import { LossFunctions } from "../nn.loss";
import { Optimizers } from "../nn.optimizers";
import type { ILossFunction, IOptimizer, ITrainingContext } from "../nn.training";
import { ConstrainedLifSurrogateSubgraph, surrogateDerivative, type LifSurrogateMode } from "./lif-surrogate.subgraph";
import type { IConstrainedLifBpttOptions, ILifSurrogateFitOptions, ILifSurrogateFitResult, ILifSurrogateForwardStep } from "./lif-surrogate.training";
import { SpikeSynapse } from "./spike.synapse";

export interface ILifSurrogateNetworkInputBinding {
    /** Column in every timestep's external input vector. */
    inputIndex: number;
    /** Synapse from an external source node to a teacher integrate stage. */
    synapse: SpikeSynapse;
}

export interface IConstrainedLifTrainingNetwork {
    /** Teachers in topological order for zero-delay connections. */
    neurons: ReadonlyArray<ConstrainedLifSurrogateSubgraph>;
    inputs: ReadonlyArray<ILifSurrogateNetworkInputBinding>;
    /** Trainable synapses between teacher threshold and integrate stages. Delayed synapses may be recurrent. */
    connections: ReadonlyArray<SpikeSynapse>;
    /** Teachers whose binary spikes receive supervised targets. */
    outputs: ReadonlyArray<ConstrainedLifSurrogateSubgraph>;
}

export interface ILifSurrogateNetworkTrainingSequence {
    inputs: ReadonlyArray<ReadonlyArray<number>>;
    /** Targets indexed by timestep then supervised output teacher. */
    targets: ReadonlyArray<ReadonlyArray<number>>;
    /** Optional non-negative loss weights, indexed like targets. */
    lossWeights?: ReadonlyArray<ReadonlyArray<number>>;
    /**
     * Optional classification objective computed from the exact native LIF
     * decoder score. Forward spikes remain binary. Only the derivative of
     * each hard spike decision is substituted during BPTT.
     */
    runtimeDecoderObjective?: ILifSurrogateRuntimeDecoderObjective;
    timestamps?: ReadonlyArray<number>;
}

export interface ILifSurrogateRuntimeDecoderObjective {
    /** Index in the supervised output list. */
    targetOutput: number;
    /** Contribution of every emitted output spike to the class score. */
    spikeCountScale?: number;
    /** Contribution of final membrane / threshold to the class score. */
    membranePotentialScale?: number;
    /** Softmax temperature used by the training loss, without changing argmax. */
    temperature?: number;
    /** Multiplier applied to decoder cross-entropy. Defaults to 1. */
    classificationLossWeight?: number;
    /** Multiplier applied to the existing timestep loss. Defaults to 1. */
    temporalLossWeight?: number;
}

export interface ILifSurrogateNetworkForwardStep {
    timestamp: number;
    neurons: ReadonlyArray<ILifSurrogateForwardStep>;
    outputs: ReadonlyArray<number>;
}

export interface ILifSurrogateNetworkForwardTrace {
    steps: ReadonlyArray<ILifSurrogateNetworkForwardStep>;
    loss: number;
    temporalLoss: number;
    runtimeDecoderLoss: number | null;
    runtimeDecoderScores: ReadonlyArray<number> | null;
    runtimeDecoderProbabilities: ReadonlyArray<number> | null;
}

export interface ILifSurrogateNetworkGradientResult extends ILifSurrogateNetworkForwardTrace {
    gradients: ReadonlyMap<SpikeSynapse, number>;
}

interface ITrainingEdge {
    synapse: SpikeSynapse;
    targetNeuron: number;
    sourceNeuron?: number;
    inputIndex?: number;
    delay: number;
}

/**
 * BPTT over a network of constrained LIF teacher motifs.
 *
 * Temporal gradients travel through each membrane feedback state. Spatial
 * gradients travel in reverse topological order through zero-delay edges.
 * Delayed edges may point backward or to the same teacher, which provides a
 * recurrent path across scheduler ticks. Every teacher remains independently
 * compilable to one LifNeuronNode after training.
 */
export class ConstrainedLifNetworkBpttTrainer {
    private readonly _context: ITrainingContext = { iteration: 0 };
    private readonly _incoming: ReadonlyArray<ReadonlyArray<ITrainingEdge>>;
    private readonly _outputIndices: ReadonlyArray<number>;
    private readonly _synapses: ReadonlyArray<SpikeSynapse>;

    private _learningRate = 0.01;
    public readonly lossFunction: ILossFunction;
    public readonly optimizer: IOptimizer;
    public readonly timeStep: number;
    public readonly gradientClip: number;
    public readonly inputCount: number;

    public constructor(
        public readonly network: IConstrainedLifTrainingNetwork,
        options: IConstrainedLifBpttOptions = {}
    ) {
        if (network.neurons.length === 0) throw new Error("A constrained LIF training network requires at least one teacher neuron.");
        if (network.outputs.length === 0) throw new Error("A constrained LIF training network requires at least one supervised output.");

        const edges: ITrainingEdge[] = [];
        let maxInputIndex = -1;
        for (const binding of network.inputs) {
            if (!Number.isInteger(binding.inputIndex) || binding.inputIndex < 0) {
                throw new Error("Constrained LIF external input indices must be non-negative integers.");
            }
            const targetNeuron = network.neurons.findIndex((neuron) => neuron.inputNode === binding.synapse.ofin);
            if (targetNeuron < 0) throw new Error("Every external input synapse must target a teacher integrate stage.");
            assertImmediate(binding.synapse);
            edges.push({ synapse: binding.synapse, targetNeuron, inputIndex: binding.inputIndex, delay: 0 });
            maxInputIndex = Math.max(maxInputIndex, binding.inputIndex);
        }

        for (const synapse of network.connections) {
            const sourceNeuron = network.neurons.findIndex((neuron) => neuron.outputNode === synapse.oini);
            const targetNeuron = network.neurons.findIndex((neuron) => neuron.inputNode === synapse.ofin);
            if (sourceNeuron < 0 || targetNeuron < 0) {
                throw new Error("Every constrained LIF connection must join a teacher threshold stage to a teacher integrate stage.");
            }
            if (synapse.delay === 0 && sourceNeuron >= targetNeuron) {
                throw new Error("Constrained LIF teachers and connections must be supplied in feed-forward topological order.");
            }
            edges.push({ synapse, sourceNeuron, targetNeuron, delay: synapse.delay });
        }

        const uniqueSynapses = new Set(edges.map((edge) => edge.synapse));
        if (uniqueSynapses.size !== edges.length) throw new Error("A trainable SpikeSynapse can appear only once in a constrained LIF network.");

        this._outputIndices = network.outputs.map((output) => {
            const index = network.neurons.indexOf(output);
            if (index < 0) throw new Error("Every supervised output must belong to the constrained LIF training network.");
            return index;
        });
        if (new Set(this._outputIndices).size !== this._outputIndices.length) {
            throw new Error("A constrained LIF teacher can appear only once in the supervised output list.");
        }

        const incoming = network.neurons.map(() => [] as ITrainingEdge[]);
        for (const edge of edges) incoming[edge.targetNeuron].push(edge);
        for (let neuron = 0; neuron < incoming.length; neuron++) {
            if (incoming[neuron].length === 0) throw new Error(`Constrained LIF teacher ${network.neurons[neuron].groupId} has no trainable input.`);
        }

        this._incoming = incoming;
        this._synapses = edges.map((edge) => edge.synapse);
        this.inputCount = maxInputIndex + 1;
        if (this.inputCount === 0) throw new Error("A constrained LIF training network requires at least one external input.");

        this.learningRate = positiveOr(options.learningRate, 0.01);
        this.lossFunction = options.lossFunction ?? LossFunctions.MSE;
        this.optimizer = options.optimizer ?? Optimizers.Adam();
        this.timeStep = positiveOr(options.timeStep, network.neurons[0].config.membraneTimeConstant);
        this.gradientClip = positiveOr(options.gradientClip, Number.POSITIVE_INFINITY);
    }

    public get trainingContext(): Readonly<ITrainingContext> {
        return this._context;
    }

    public get learningRate(): number {
        return this._learningRate;
    }

    public set learningRate(value: number) {
        if (!Number.isFinite(value) || value <= 0) throw new Error("Constrained LIF network learning rate must be positive.");
        this._learningRate = value;
    }

    public get synapses(): ReadonlyArray<SpikeSynapse> {
        return this._synapses;
    }

    public forward(sequence: ILifSurrogateNetworkTrainingSequence, mode: LifSurrogateMode = "training"): ILifSurrogateNetworkForwardTrace {
        return this._forward(sequence, mode);
    }

    /**
     * Compatibility replay surface. Every teacher now has identical hard
     * forward dynamics; the selected mode affects no runtime value.
     */
    public forwardMixed(sequence: ILifSurrogateNetworkTrainingSequence, modes: ReadonlyArray<LifSurrogateMode>): ILifSurrogateNetworkForwardTrace {
        if (modes.length !== this.network.neurons.length) {
            throw new Error(`Expected ${this.network.neurons.length} constrained LIF replay modes, received ${modes.length}.`);
        }
        if (modes.some((mode) => mode !== "training" && mode !== "soft" && mode !== "hard")) {
            throw new Error("Constrained LIF replay modes must be training or hard.");
        }
        return this._forward(sequence, "training", modes);
    }

    public gradients(sequence: ILifSurrogateNetworkTrainingSequence): ILifSurrogateNetworkGradientResult {
        const trace = this._forward(sequence, "training");
        const gradientBySynapse = new Map<SpikeSynapse, number>(this._synapses.map((synapse) => [synapse, 0]));
        const dStateFromFuture = new Array(this.network.neurons.length).fill(0) as number[];
        const dProbabilityByTime = trace.steps.map(() => new Array(this.network.neurons.length).fill(0) as number[]);
        const normalization = lossWeightSum(sequence, this._outputIndices.length);
        const objective = normalizedRuntimeDecoderObjective(sequence.runtimeDecoderObjective);
        const temporalLossWeight = objective?.temporalLossWeight ?? 1;

        if (objective && trace.runtimeDecoderProbabilities) {
            for (let output = 0; output < this._outputIndices.length; output++) {
                const neuron = this._outputIndices[output];
                const target = output === objective.targetOutput ? 1 : 0;
                const dScore = (objective.classificationLossWeight * (trace.runtimeDecoderProbabilities[output] - target)) / objective.temperature;
                for (let t = 0; t < trace.steps.length; t++) {
                    dProbabilityByTime[t][neuron] += dScore * objective.spikeCountScale;
                }
                const threshold = this.network.neurons[neuron].config.threshold;
                dStateFromFuture[neuron] += (dScore * objective.membranePotentialScale) / threshold;
            }
        }

        for (let t = trace.steps.length - 1; t >= 0; t--) {
            const networkStep = trace.steps[t];
            const dProbability = dProbabilityByTime[t];
            for (let output = 0; output < this._outputIndices.length; output++) {
                const neuron = this._outputIndices[output];
                const weight = sequence.lossWeights?.[t][output] ?? 1;
                dProbability[neuron] +=
                    (temporalLossWeight * weight * this.lossFunction.dLoss(networkStep.neurons[neuron].probability, sequence.targets[t][output])) / normalization;
            }

            for (let neuron = this.network.neurons.length - 1; neuron >= 0; neuron--) {
                const step = networkStep.neurons[neuron];
                if (!step.hasEvent) continue;

                let dIntegrated = dStateFromFuture[neuron];
                if (step.canFire) {
                    const config = this.network.neurons[neuron].config;
                    const dProbabilityDIntegrated = step.surrogateDerivative;
                    const dStateDProbability = config.resetPotential - step.integratedPotential;
                    dIntegrated =
                        dStateFromFuture[neuron] * (1 - step.probability) + (dProbability[neuron] + dStateFromFuture[neuron] * dStateDProbability) * dProbabilityDIntegrated;
                }

                const incoming = this._incoming[neuron];
                for (let input = 0; input < incoming.length; input++) {
                    const edge = incoming[input];
                    if (!edge.synapse.enabled) continue;
                    const amplitude = step.inputs[input];
                    gradientBySynapse.set(edge.synapse, gradientBySynapse.get(edge.synapse)! + dIntegrated * amplitude);

                    if (edge.sourceNeuron !== undefined) {
                        const sourceTime = t - edge.delay;
                        if (sourceTime < 0) continue;
                        const sourceStep = trace.steps[sourceTime].neurons[edge.sourceNeuron];
                        if (sourceStep.canFire) {
                            dProbabilityByTime[sourceTime][edge.sourceNeuron] += dIntegrated * edge.synapse.weight * this.network.neurons[edge.sourceNeuron].config.spikeAmplitude;
                        }
                    }
                }
                dStateFromFuture[neuron] = dIntegrated * step.leakFactor;
            }
        }

        for (const [synapse, gradient] of gradientBySynapse) {
            gradientBySynapse.set(synapse, clip(gradient, this.gradientClip));
        }
        return { ...trace, gradients: gradientBySynapse };
    }

    public trainStep(sequence: ILifSurrogateNetworkTrainingSequence): number {
        const result = this.gradients(sequence);
        for (const synapse of this._synapses) {
            this.optimizer.apply(synapse, this.learningRate, result.gradients.get(synapse)!, this._context);
        }
        this._context.loss = result.loss;
        this._context.iteration++;
        return result.loss;
    }

    /** Apply one optimizer update from the mean gradient of a sequence batch. */
    public trainBatch(dataset: ReadonlyArray<ILifSurrogateNetworkTrainingSequence>): number {
        if (dataset.length === 0) throw new Error("Cannot train on an empty constrained LIF network batch.");
        const accumulated = new Map<SpikeSynapse, number>(this._synapses.map((synapse) => [synapse, 0]));
        let loss = 0;
        for (const sequence of dataset) {
            const result = this.gradients(sequence);
            loss += result.loss;
            for (const synapse of this._synapses) {
                accumulated.set(synapse, accumulated.get(synapse)! + result.gradients.get(synapse)! / dataset.length);
            }
        }
        for (const synapse of this._synapses) {
            this.optimizer.apply(synapse, this.learningRate, accumulated.get(synapse)!, this._context);
        }
        const meanLoss = loss / dataset.length;
        this._context.loss = meanLoss;
        this._context.batchIndex = 0;
        this._context.batchSize = dataset.length;
        this._context.iteration++;
        return meanLoss;
    }

    public evaluate(dataset: ReadonlyArray<ILifSurrogateNetworkTrainingSequence>, mode: LifSurrogateMode = "training"): number {
        if (dataset.length === 0) throw new Error("Cannot evaluate an empty constrained LIF network dataset.");
        let loss = 0;
        for (const sequence of dataset) loss += this._forward(sequence, mode).loss;
        return loss / dataset.length;
    }

    public fit(dataset: ReadonlyArray<ILifSurrogateNetworkTrainingSequence>, options: ILifSurrogateFitOptions): ILifSurrogateFitResult {
        if (dataset.length === 0) throw new Error("Cannot train on an empty constrained LIF network dataset.");
        const epochs = Math.max(0, Math.floor(options.epochs));
        const history: number[] = [];
        const initialLoss = this.evaluate(dataset);
        let bestLoss = initialLoss;
        let bestEpoch = -1;
        let bestWeights = this.weights();

        for (let epoch = 0; epoch < epochs; epoch++) {
            this._context.epoch = epoch;
            this.trainBatch(dataset);
            const loss = this.evaluate(dataset);
            history.push(loss);
            if (loss < bestLoss) {
                bestLoss = loss;
                bestEpoch = epoch;
                bestWeights = this.weights();
            }
        }

        if (options.restoreBest !== false) {
            this.restoreWeights(bestWeights);
            this.resetOptimizerState();
        }
        return {
            initialLoss,
            bestLoss,
            finalLoss: this.evaluate(dataset),
            bestEpoch,
            history,
            weights: this.weights(),
        };
    }

    public weights(): number[] {
        return this._synapses.map((synapse) => synapse.weight);
    }

    public restoreWeights(weights: ReadonlyArray<number>): void {
        if (weights.length !== this._synapses.length) {
            throw new Error(`Expected ${this._synapses.length} constrained LIF network weights, received ${weights.length}.`);
        }
        for (let i = 0; i < weights.length; i++) {
            if (!Number.isFinite(weights[i])) throw new Error(`Constrained LIF network weight ${i} is not finite.`);
            this._synapses[i].weight = weights[i];
        }
    }

    public resetOptimizerState(): void {
        for (const synapse of this._synapses) synapse.bag = undefined;
        this._context.iteration = 0;
        this._context.epoch = undefined;
        this._context.batchIndex = undefined;
        this._context.batchSize = undefined;
        this._context.loss = undefined;
    }

    private _forward(sequence: ILifSurrogateNetworkTrainingSequence, _mode: LifSurrogateMode, _neuronModes?: ReadonlyArray<LifSurrogateMode>): ILifSurrogateNetworkForwardTrace {
        validateSequence(sequence, this.inputCount, this._outputIndices.length, this.timeStep);
        const membranePotentials = this.network.neurons.map((neuron) => neuron.config.initialPotential);
        const lastEventTimes = this.network.neurons.map(() => null as number | null);
        const steps: ILifSurrogateNetworkForwardStep[] = [];
        let totalLoss = 0;

        for (let t = 0; t < sequence.inputs.length; t++) {
            const timestamp = sequence.timestamps?.[t] ?? t * this.timeStep;
            const neuronSteps: ILifSurrogateForwardStep[] = [];

            for (let neuron = 0; neuron < this.network.neurons.length; neuron++) {
                const config = this.network.neurons[neuron].config;
                const previousPotential = membranePotentials[neuron];
                const incomingAmplitudes: number[] = [];
                let weightedInput = 0;
                let hasEvent = false;

                for (const edge of this._incoming[neuron]) {
                    let amplitude = 0;
                    let emitted = false;
                    if (edge.synapse.enabled && edge.inputIndex !== undefined) {
                        amplitude = sequence.inputs[t][edge.inputIndex];
                        emitted = amplitude !== 0;
                    } else if (edge.synapse.enabled && edge.sourceNeuron !== undefined) {
                        const sourceTime = t - edge.delay;
                        const sourceStep = sourceTime < 0 ? null : edge.delay === 0 ? neuronSteps[edge.sourceNeuron] : steps[sourceTime].neurons[edge.sourceNeuron];
                        emitted = sourceStep !== null && sourceStep.probability === 1;
                        if (emitted && sourceStep) amplitude = this.network.neurons[edge.sourceNeuron].config.spikeAmplitude * sourceStep.probability;
                    }
                    incomingAmplitudes.push(amplitude);
                    if (emitted) hasEvent = true;
                    weightedInput += edge.synapse.weight * amplitude;
                }

                let leakFactor = 1;
                let integratedPotential = previousPotential;
                let localSurrogateDerivative = 0;
                let probability = 0;
                const canFire = hasEvent && weightedInput !== 0;
                if (hasEvent) {
                    const lastEventTime = lastEventTimes[neuron];
                    if (lastEventTime !== null && timestamp > lastEventTime) {
                        leakFactor = Math.exp(-(timestamp - lastEventTime) / config.membraneTimeConstant);
                        integratedPotential = config.restingPotential + (previousPotential - config.restingPotential) * leakFactor;
                    }
                    integratedPotential += weightedInput;
                    probability = canFire && integratedPotential >= config.threshold ? 1 : 0;
                    localSurrogateDerivative = canFire ? surrogateDerivative(integratedPotential, config.threshold, config.surrogateSlope) : 0;
                    membranePotentials[neuron] = probability === 1 ? config.resetPotential : integratedPotential;
                    lastEventTimes[neuron] = timestamp;
                }

                neuronSteps.push({
                    timestamp,
                    inputs: incomingAmplitudes,
                    hasEvent,
                    canFire,
                    leakFactor,
                    previousPotential,
                    integratedPotential,
                    surrogateDerivative: localSurrogateDerivative,
                    probability,
                    membranePotential: membranePotentials[neuron],
                });
            }

            const outputs = this._outputIndices.map((neuron) => neuronSteps[neuron].probability);
            for (let output = 0; output < outputs.length; output++) {
                totalLoss += (sequence.lossWeights?.[t][output] ?? 1) * this.lossFunction.loss(outputs[output], sequence.targets[t][output]);
            }
            steps.push({ timestamp, neurons: neuronSteps, outputs });
        }

        const temporalLoss = totalLoss / lossWeightSum(sequence, this._outputIndices.length);
        const objective = normalizedRuntimeDecoderObjective(sequence.runtimeDecoderObjective);
        const decoder = objective ? runtimeDecoderOfTrace(steps, this._outputIndices, this.network.neurons, objective) : null;
        return {
            steps,
            temporalLoss,
            runtimeDecoderLoss: decoder?.loss ?? null,
            runtimeDecoderScores: decoder?.scores ?? null,
            runtimeDecoderProbabilities: decoder?.probabilities ?? null,
            loss: (objective?.temporalLossWeight ?? 1) * temporalLoss + (decoder ? objective!.classificationLossWeight * decoder.loss : 0),
        };
    }
}

function validateSequence(sequence: ILifSurrogateNetworkTrainingSequence, inputCount: number, outputCount: number, timeStep: number): void {
    if (sequence.inputs.length === 0) throw new Error("A constrained LIF network sequence cannot be empty.");
    if (sequence.inputs.length !== sequence.targets.length) {
        throw new Error(`Input sequence length ${sequence.inputs.length} does not match target length ${sequence.targets.length}.`);
    }
    if (sequence.timestamps && sequence.timestamps.length !== sequence.inputs.length) {
        throw new Error(`Timestamp sequence length ${sequence.timestamps.length} does not match input length ${sequence.inputs.length}.`);
    }
    if (sequence.lossWeights && sequence.lossWeights.length !== sequence.inputs.length) {
        throw new Error(`Loss-weight sequence length ${sequence.lossWeights.length} does not match input length ${sequence.inputs.length}.`);
    }
    validateRuntimeDecoderObjective(sequence.runtimeDecoderObjective, outputCount);

    let previousTimestamp = Number.NEGATIVE_INFINITY;
    for (let t = 0; t < sequence.inputs.length; t++) {
        if (sequence.inputs[t].length !== inputCount) throw new Error(`Timestep ${t} has ${sequence.inputs[t].length} inputs, expected ${inputCount}.`);
        if (sequence.targets[t].length !== outputCount) throw new Error(`Timestep ${t} has ${sequence.targets[t].length} targets, expected ${outputCount}.`);
        if (sequence.lossWeights && sequence.lossWeights[t].length !== outputCount) {
            throw new Error(`Timestep ${t} has ${sequence.lossWeights[t].length} loss weights, expected ${outputCount}.`);
        }
        if (sequence.inputs[t].some((value) => !Number.isFinite(value))) throw new Error(`Timestep ${t} contains a non-finite spike amplitude.`);
        if (sequence.targets[t].some((value) => !Number.isFinite(value))) throw new Error(`Timestep ${t} contains a non-finite target.`);
        if (sequence.lossWeights?.[t].some((value) => !Number.isFinite(value) || value < 0)) {
            throw new Error(`Timestep ${t} contains an invalid loss weight.`);
        }
        const timestamp = sequence.timestamps?.[t] ?? t * timeStep;
        if (!Number.isFinite(timestamp) || timestamp < previousTimestamp) throw new Error("Constrained LIF timestamps must be finite and monotonic.");
        previousTimestamp = timestamp;
    }
}

interface INormalizedRuntimeDecoderObjective {
    targetOutput: number;
    spikeCountScale: number;
    membranePotentialScale: number;
    temperature: number;
    classificationLossWeight: number;
    temporalLossWeight: number;
}

interface IRuntimeDecoderEvaluation {
    scores: number[];
    probabilities: number[];
    loss: number;
}

function normalizedRuntimeDecoderObjective(objective: ILifSurrogateRuntimeDecoderObjective | undefined): INormalizedRuntimeDecoderObjective | null {
    if (!objective) return null;
    return {
        targetOutput: objective.targetOutput,
        spikeCountScale: objective.spikeCountScale ?? 2,
        membranePotentialScale: objective.membranePotentialScale ?? 1,
        temperature: objective.temperature ?? 1,
        classificationLossWeight: objective.classificationLossWeight ?? 1,
        temporalLossWeight: objective.temporalLossWeight ?? 1,
    };
}

function validateRuntimeDecoderObjective(objective: ILifSurrogateRuntimeDecoderObjective | undefined, outputCount: number): void {
    if (!objective) return;
    const normalized = normalizedRuntimeDecoderObjective(objective)!;
    if (!Number.isInteger(normalized.targetOutput) || normalized.targetOutput < 0 || normalized.targetOutput >= outputCount) {
        throw new Error(`Runtime decoder target ${normalized.targetOutput} is outside the supervised output range.`);
    }
    if (!Number.isFinite(normalized.spikeCountScale) || normalized.spikeCountScale < 0) {
        throw new Error("Runtime decoder spike-count scale must be finite and non-negative.");
    }
    if (!Number.isFinite(normalized.membranePotentialScale) || normalized.membranePotentialScale < 0) {
        throw new Error("Runtime decoder membrane-potential scale must be finite and non-negative.");
    }
    if (!Number.isFinite(normalized.temperature) || normalized.temperature <= 0) {
        throw new Error("Runtime decoder temperature must be finite and positive.");
    }
    if (!Number.isFinite(normalized.classificationLossWeight) || normalized.classificationLossWeight < 0) {
        throw new Error("Runtime decoder classification-loss weight must be finite and non-negative.");
    }
    if (!Number.isFinite(normalized.temporalLossWeight) || normalized.temporalLossWeight < 0) {
        throw new Error("Runtime decoder temporal-loss weight must be finite and non-negative.");
    }
    if (!(normalized.classificationLossWeight > 0 || normalized.temporalLossWeight > 0)) {
        throw new Error("Runtime decoder objective requires a positive classification or temporal loss weight.");
    }
    if (normalized.classificationLossWeight > 0 && !(normalized.spikeCountScale > 0 || normalized.membranePotentialScale > 0)) {
        throw new Error("Runtime decoder classification requires a positive spike-count or membrane-potential scale.");
    }
}

function runtimeDecoderOfTrace(
    steps: ReadonlyArray<ILifSurrogateNetworkForwardStep>,
    outputIndices: ReadonlyArray<number>,
    neurons: ReadonlyArray<ConstrainedLifSurrogateSubgraph>,
    objective: INormalizedRuntimeDecoderObjective
): IRuntimeDecoderEvaluation {
    const finalStep = steps[steps.length - 1];
    const scores = outputIndices.map((neuron, output) => {
        let spikeCount = 0;
        for (const step of steps) spikeCount += step.outputs[output];
        return objective.spikeCountScale * spikeCount + objective.membranePotentialScale * (finalStep.neurons[neuron].membranePotential / neurons[neuron].config.threshold);
    });
    const logits = scores.map((score) => score / objective.temperature);
    const maximum = Math.max(...logits);
    const exponentials = logits.map((logit) => Math.exp(logit - maximum));
    const total = exponentials.reduce((sum, value) => sum + value, 0);
    const probabilities = exponentials.map((value) => value / total);
    return {
        scores,
        probabilities,
        loss: -Math.log(Math.max(probabilities[objective.targetOutput], 1e-12)),
    };
}

function lossWeightSum(sequence: ILifSurrogateNetworkTrainingSequence, outputCount: number): number {
    if (!sequence.lossWeights) return sequence.inputs.length * outputCount;
    let total = 0;
    for (const weights of sequence.lossWeights) {
        for (const weight of weights) total += weight;
    }
    if (!(total > 0)) throw new Error("A constrained LIF network sequence requires a positive total loss weight.");
    return total;
}

function assertImmediate(synapse: SpikeSynapse): void {
    if (synapse.delay !== 0) throw new Error("Delayed synapses are not supported by the first constrained LIF network BPTT trainer.");
}

function positiveOr(value: number | undefined, fallback: number): number {
    return value !== undefined && Number.isFinite(value) && value > 0 ? value : fallback;
}

function clip(value: number, limit: number): number {
    return Math.max(-limit, Math.min(limit, value));
}
