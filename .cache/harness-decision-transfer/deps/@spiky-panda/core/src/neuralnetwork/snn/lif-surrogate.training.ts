import type { ILossFunction, IOptimizer, ITrainingContext } from "../nn.training";
import { LossFunctions } from "../nn.loss";
import { Optimizers } from "../nn.optimizers";
import { ConstrainedLifSurrogateSubgraph, surrogateDerivative, type LifSurrogateMode } from "./lif-surrogate.subgraph";
import { SpikeSynapse } from "./spike.synapse";

export interface ILifSurrogateTrainingSequence {
    /** Spike amplitudes, indexed by timestep then input synapse. Zero means no event. */
    inputs: ReadonlyArray<ReadonlyArray<number>>;
    /** Desired spike probability, normally zero or one, for every timestep. */
    targets: ReadonlyArray<number>;
    /** Optional simulation timestamps. Defaults to t * timeStep. */
    timestamps?: ReadonlyArray<number>;
}

export interface ILifSurrogateForwardStep {
    timestamp: number;
    inputs: ReadonlyArray<number>;
    target?: number;
    hasEvent: boolean;
    canFire: boolean;
    leakFactor: number;
    previousPotential: number;
    integratedPotential: number;
    /** Backward-only derivative evaluated around the exact hard threshold. */
    surrogateDerivative: number;
    /** Exact binary forward spike, retained under the historical name. */
    probability: number;
    membranePotential: number;
}

export interface ILifSurrogateForwardTrace {
    steps: ReadonlyArray<ILifSurrogateForwardStep>;
    loss: number;
}

export interface ILifSurrogateGradientResult extends ILifSurrogateForwardTrace {
    gradients: ReadonlyArray<number>;
}

export interface IConstrainedLifBpttOptions {
    learningRate?: number;
    lossFunction?: ILossFunction;
    optimizer?: IOptimizer;
    /** Used only when a training sequence does not provide timestamps. */
    timeStep?: number;
    /** Symmetric clipping limit applied independently to every synaptic gradient. */
    gradientClip?: number;
}

export interface ILifSurrogateFitOptions {
    epochs: number;
    /** Restore the lowest-loss weights after the last epoch. Defaults to true. */
    restoreBest?: boolean;
}

export interface ILifSurrogateFitResult {
    initialLoss: number;
    bestLoss: number;
    finalLoss: number;
    bestEpoch: number;
    history: ReadonlyArray<number>;
    weights: ReadonlyArray<number>;
}

/**
 * Full BPTT trainer for one constrained LIF teacher motif.
 *
 * It updates the actual incoming SpikeSynapse instances. The forward tape is
 * an analytical view of the same event-driven leak, binary threshold and hard
 * reset used by the native LIF. Only the backward derivative is substituted.
 * No editor object participates in training, and the learned edges remain
 * valid when the motif is compiled to one LifNeuronNode.
 */
export class ConstrainedLifBpttTrainer {
    private readonly _context: ITrainingContext = { iteration: 0 };

    public readonly learningRate: number;
    public readonly lossFunction: ILossFunction;
    public readonly optimizer: IOptimizer;
    public readonly timeStep: number;
    public readonly gradientClip: number;

    public constructor(
        public readonly surrogate: ConstrainedLifSurrogateSubgraph,
        public readonly inputSynapses: ReadonlyArray<SpikeSynapse>,
        options: IConstrainedLifBpttOptions = {}
    ) {
        if (inputSynapses.length === 0) throw new Error("Constrained LIF training requires at least one input synapse.");
        for (const synapse of inputSynapses) {
            if (synapse.ofin !== surrogate.inputNode) throw new Error("Every trained synapse must target the constrained LIF integrate stage.");
            if (synapse.delay !== 0) throw new Error("Delayed input synapses are not supported by the first constrained LIF BPTT trainer.");
        }

        this.learningRate = positiveOr(options.learningRate, 0.01);
        this.lossFunction = options.lossFunction ?? LossFunctions.MSE;
        this.optimizer = options.optimizer ?? Optimizers.Adam();
        this.timeStep = positiveOr(options.timeStep, surrogate.config.membraneTimeConstant);
        this.gradientClip = positiveOr(options.gradientClip, Number.POSITIVE_INFINITY);
    }

    public get trainingContext(): Readonly<ITrainingContext> {
        return this._context;
    }

    /** Run the exact hard teacher without changing any parameter. */
    public forward(sequence: ILifSurrogateTrainingSequence, mode: LifSurrogateMode = "training"): ILifSurrogateForwardTrace {
        return this._forward(sequence, mode);
    }

    /** Compute full temporal gradients without applying them. */
    public gradients(sequence: ILifSurrogateTrainingSequence): ILifSurrogateGradientResult {
        const trace = this._forward(sequence, "training");
        const gradients = new Array(this.inputSynapses.length).fill(0) as number[];
        const config = this.surrogate.config;
        let dStateFromFuture = 0;

        for (let t = trace.steps.length - 1; t >= 0; t--) {
            const step = trace.steps[t];
            if (!step.hasEvent) {
                // No RuntimeNode fires on an empty event tick. The membrane is
                // carried unchanged, so the temporal gradient is an identity.
                continue;
            }

            if (!step.canFire) {
                // A real zero-amplitude delivery advances the leak state but
                // the runtime deliberately gates the threshold at p = 0.
                for (let input = 0; input < gradients.length; input++) {
                    if (this.inputSynapses[input].enabled) gradients[input] += dStateFromFuture * step.inputs[input];
                }
                dStateFromFuture *= step.leakFactor;
                continue;
            }

            const dLossDProbability = this.lossFunction.dLoss(step.probability, sequence.targets[t]) / trace.steps.length;
            const dProbabilityDIntegrated = step.surrogateDerivative;
            const dStateDProbability = config.resetPotential - step.integratedPotential;
            const dLossDIntegrated = dStateFromFuture * (1 - step.probability) + (dLossDProbability + dStateFromFuture * dStateDProbability) * dProbabilityDIntegrated;

            for (let input = 0; input < gradients.length; input++) {
                if (this.inputSynapses[input].enabled) gradients[input] += dLossDIntegrated * step.inputs[input];
            }
            dStateFromFuture = dLossDIntegrated * step.leakFactor;
        }

        return {
            ...trace,
            gradients: gradients.map((gradient) => clip(gradient, this.gradientClip)),
        };
    }

    /** Train on one temporal sequence and return its pre-update loss. */
    public trainStep(sequence: ILifSurrogateTrainingSequence): number {
        const result = this.gradients(sequence);
        for (let i = 0; i < this.inputSynapses.length; i++) {
            this.optimizer.apply(this.inputSynapses[i], this.learningRate, result.gradients[i], this._context);
        }
        this._context.loss = result.loss;
        this._context.iteration++;
        return result.loss;
    }

    public evaluate(dataset: ReadonlyArray<ILifSurrogateTrainingSequence>, mode: LifSurrogateMode = "training"): number {
        if (dataset.length === 0) throw new Error("Cannot evaluate an empty constrained LIF dataset.");
        let loss = 0;
        for (const sequence of dataset) loss += this._forward(sequence, mode).loss;
        return loss / dataset.length;
    }

    /**
     * Online Adam training with an in-memory best-weight checkpoint. The best
     * checkpoint is restored by default, matching the motor-current trainers.
     */
    public fit(dataset: ReadonlyArray<ILifSurrogateTrainingSequence>, options: ILifSurrogateFitOptions): ILifSurrogateFitResult {
        if (dataset.length === 0) throw new Error("Cannot train on an empty constrained LIF dataset.");
        const epochs = Math.max(0, Math.floor(options.epochs));
        const history: number[] = [];
        const initialLoss = this.evaluate(dataset);
        let bestLoss = initialLoss;
        let bestEpoch = -1;
        let bestWeights = this.weights();

        for (let epoch = 0; epoch < epochs; epoch++) {
            this._context.epoch = epoch;
            for (let sample = 0; sample < dataset.length; sample++) {
                this._context.batchIndex = sample;
                this._context.batchSize = 1;
                this.trainStep(dataset[sample]);
            }
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
        return this.inputSynapses.map((synapse) => synapse.weight);
    }

    public restoreWeights(weights: ReadonlyArray<number>): void {
        if (weights.length !== this.inputSynapses.length) {
            throw new Error(`Expected ${this.inputSynapses.length} constrained LIF weights, received ${weights.length}.`);
        }
        for (let i = 0; i < weights.length; i++) {
            if (!Number.isFinite(weights[i])) throw new Error(`Constrained LIF weight ${i} is not finite.`);
            this.inputSynapses[i].weight = weights[i];
        }
    }

    public resetOptimizerState(): void {
        for (const synapse of this.inputSynapses) synapse.bag = undefined;
        this._context.iteration = 0;
        this._context.epoch = undefined;
        this._context.batchIndex = undefined;
        this._context.batchSize = undefined;
        this._context.loss = undefined;
    }

    private _forward(sequence: ILifSurrogateTrainingSequence, _mode: LifSurrogateMode): ILifSurrogateForwardTrace {
        validateSequence(sequence, this.inputSynapses.length, this.timeStep);
        const config = this.surrogate.config;
        const steps: ILifSurrogateForwardStep[] = [];
        let membranePotential = config.initialPotential;
        let lastEventTime: number | null = null;
        let totalLoss = 0;

        for (let t = 0; t < sequence.inputs.length; t++) {
            const inputs = sequence.inputs[t];
            const timestamp = sequence.timestamps?.[t] ?? t * this.timeStep;
            const previousPotential = membranePotential;
            const hasEvent = inputs.some((amplitude) => amplitude !== 0);
            let leakFactor = 1;
            let integratedPotential = previousPotential;
            let localSurrogateDerivative = 0;
            let probability = 0;
            let canFire = false;

            if (hasEvent) {
                if (lastEventTime !== null && timestamp > lastEventTime) {
                    leakFactor = Math.exp(-(timestamp - lastEventTime) / config.membraneTimeConstant);
                    integratedPotential = config.restingPotential + (previousPotential - config.restingPotential) * leakFactor;
                }

                let weightedInput = 0;
                for (let input = 0; input < inputs.length; input++) {
                    if (this.inputSynapses[input].enabled) weightedInput += inputs[input] * this.inputSynapses[input].weight;
                }
                integratedPotential += weightedInput;
                canFire = weightedInput !== 0;

                probability = canFire && integratedPotential >= config.threshold ? 1 : 0;
                localSurrogateDerivative = canFire ? surrogateDerivative(integratedPotential, config.threshold, config.surrogateSlope) : 0;
                membranePotential = probability === 1 ? config.resetPotential : integratedPotential;
                lastEventTime = timestamp;
            }

            totalLoss += this.lossFunction.loss(probability, sequence.targets[t]);
            steps.push({
                timestamp,
                inputs: [...inputs],
                target: sequence.targets[t],
                hasEvent,
                canFire,
                leakFactor,
                previousPotential,
                integratedPotential,
                surrogateDerivative: localSurrogateDerivative,
                probability,
                membranePotential,
            });
        }

        return { steps, loss: totalLoss / steps.length };
    }
}

function validateSequence(sequence: ILifSurrogateTrainingSequence, inputCount: number, timeStep: number): void {
    if (sequence.inputs.length === 0) throw new Error("A constrained LIF training sequence cannot be empty.");
    if (sequence.inputs.length !== sequence.targets.length) {
        throw new Error(`Input sequence length ${sequence.inputs.length} does not match target length ${sequence.targets.length}.`);
    }
    if (sequence.timestamps && sequence.timestamps.length !== sequence.inputs.length) {
        throw new Error(`Timestamp sequence length ${sequence.timestamps.length} does not match input length ${sequence.inputs.length}.`);
    }

    let previousTimestamp = Number.NEGATIVE_INFINITY;
    for (let t = 0; t < sequence.inputs.length; t++) {
        const inputs = sequence.inputs[t];
        if (inputs.length !== inputCount) throw new Error(`Timestep ${t} has ${inputs.length} inputs, expected ${inputCount}.`);
        if (inputs.some((value) => !Number.isFinite(value))) throw new Error(`Timestep ${t} contains a non-finite spike amplitude.`);
        if (!Number.isFinite(sequence.targets[t])) throw new Error(`Target ${t} is not finite.`);
        const timestamp = sequence.timestamps?.[t] ?? t * timeStep;
        if (!Number.isFinite(timestamp) || timestamp < previousTimestamp) throw new Error("Constrained LIF timestamps must be finite and monotonic.");
        previousTimestamp = timestamp;
    }
}

function positiveOr(value: number | undefined, fallback: number): number {
    return value !== undefined && Number.isFinite(value) && value > 0 ? value : fallback;
}

function clip(value: number, limit: number): number {
    return Math.max(-limit, Math.min(limit, value));
}
