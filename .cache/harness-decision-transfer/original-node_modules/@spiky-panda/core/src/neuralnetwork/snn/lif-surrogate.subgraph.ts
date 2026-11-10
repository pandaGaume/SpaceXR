import { Channel } from "../../execution/execution.channel";
import type { IDeclaresPorts, IPortDescriptor, ISession } from "../../execution/execution.interfaces";
import { RuntimeNode } from "../../execution/execution.node";
import { cloneable } from "../../graph/graph.interfaces";
import type { ISpike } from "./spike.interfaces";

export const LIF_SURROGATE_SPIKE_SLOT = "spike";
export const LIF_SURROGATE_STATE_SLOT = "lif-state";
export const LIF_SURROGATE_INTEGRATED_SLOT = "lif-integrated";
export const LIF_SURROGATE_DECISION_SLOT = "lif-decision";

/**
 * Both modes execute the exact hard LIF dynamics. `training` only indicates
 * that callers may use the surrogate derivative during backpropagation.
 * `soft` remains accepted as a legacy alias and is normalized to `training`.
 */
export type LifSurrogateMode = "training" | "hard" | "soft";

/**
 * Parameters intentionally limited to the subset that maps exactly to the
 * current Session-native LIF implementation. Refractory dynamics are omitted
 * in this first version because a differentiable soft refractory transition
 * would no longer be a one-to-one LIF compilation.
 */
export interface IConstrainedLifSurrogateConfig {
    restingPotential: number;
    initialPotential: number;
    threshold: number;
    resetPotential: number;
    membraneTimeConstant: number;
    spikeAmplitude: number;
    surrogateSlope: number;
    mode: LifSurrogateMode;
}

export interface ILifSurrogateState {
    membranePotential: number;
    lastUpdateTime: number | null;
    lastSpikeTime: number | null;
    spikeCount: number;
}

export interface ILifSurrogateIntegrated {
    timestamp: number;
    receivedAmplitude: number;
    canFire: boolean;
    state: ILifSurrogateState;
}

export interface ILifSurrogateDecision {
    integrated: ILifSurrogateIntegrated;
    probability: number;
    derivative: number;
    hardSpike: boolean;
}

/** Binary spike emitted by the hard threshold, with backward-only metadata. */
export interface ISurrogateSpike extends ISpike {
    /** Exact forward value, always one for an emitted spike. */
    probability: number;
    surrogateDerivative: number;
    hardSpike: boolean;
}

const DEFAULT_CONFIG: Readonly<IConstrainedLifSurrogateConfig> = Object.freeze({
    restingPotential: 0,
    initialPotential: 0,
    threshold: 1,
    resetPotential: 0,
    membraneTimeConstant: 0.02,
    spikeAmplitude: 1,
    surrogateSlope: 1.25,
    mode: "training",
});

const SPIKE_INPUT_PORT: IPortDescriptor = {
    slot: LIF_SURROGATE_SPIKE_SLOT,
    optional: false,
    type: "spike",
    kind: "stream",
    capacity: 1024,
};

const STATE_INPUT_PORT: IPortDescriptor = {
    slot: LIF_SURROGATE_STATE_SLOT,
    optional: false,
    type: "lif-surrogate-state",
    kind: "stream",
    capacity: 1,
};

/** First stage: analytical leak followed by weighted event integration. */
export class LifSurrogateIntegrateNode extends RuntimeNode implements IDeclaresPorts {
    public readonly inputPorts: ReadonlyArray<IPortDescriptor> = [SPIKE_INPUT_PORT, STATE_INPUT_PORT];
    public readonly outputPorts: ReadonlyArray<IPortDescriptor> = [
        { slot: LIF_SURROGATE_INTEGRATED_SLOT, optional: true, type: "lif-surrogate-integrated", kind: "stream", capacity: 1024 },
    ];

    @cloneable public groupId: string = "";
    @cloneable public restingPotential: number = DEFAULT_CONFIG.restingPotential;
    @cloneable public initialPotential: number = DEFAULT_CONFIG.initialPotential;
    @cloneable public membraneTimeConstant: number = DEFAULT_CONFIG.membraneTimeConstant;

    public constructor(groupId: string = "", config: Partial<IConstrainedLifSurrogateConfig> = {}) {
        super();
        this.groupId = groupId;
        this.restingPotential = finiteOr(config.restingPotential, DEFAULT_CONFIG.restingPotential);
        this.initialPotential = finiteOr(config.initialPotential, DEFAULT_CONFIG.initialPotential);
        this.membraneTimeConstant = positiveOr(config.membraneTimeConstant, DEFAULT_CONFIG.membraneTimeConstant);
        this.type = "snn.lif-surrogate.integrate";
    }

    public override fire(session: ISession, t: number): void {
        const previous = this.consumeState(session);
        if (!previous) return;

        const state = advanceLeak(previous, t, this.restingPotential, this.membraneTimeConstant);
        let receivedAmplitude = 0;
        for (const channel of this.inputChannels(LIF_SURROGATE_SPIKE_SLOT)) {
            if (!channel.enabled) continue;
            const index = this.channelIndex(session, channel);
            if (index < 0) continue;
            while (session.linkStates[index].ready) {
                const spike = session.consume(index);
                if (isSpike(spike)) receivedAmplitude += spike.amplitude;
            }
        }

        if (receivedAmplitude !== 0) state.membranePotential += receivedAmplitude;
        const integrated: ILifSurrogateIntegrated = {
            timestamp: t,
            receivedAmplitude,
            canFire: receivedAmplitude !== 0,
            state,
        };
        this.publishAll(session, LIF_SURROGATE_INTEGRATED_SLOT, integrated);
    }

    private consumeState(session: ISession): ILifSurrogateState | null {
        for (const channel of this.inputChannels(LIF_SURROGATE_STATE_SLOT)) {
            if (!channel.enabled) continue;
            const index = this.channelIndex(session, channel);
            if (index < 0 || !session.linkStates[index].ready) continue;
            const value = session.consume(index);
            if (isSurrogateState(value)) return value;
        }
        return null;
    }
}

/** Second stage: exact hard threshold with gradient metadata for training. */
export class LifSurrogateThresholdNode extends RuntimeNode implements IDeclaresPorts {
    public readonly inputPorts: ReadonlyArray<IPortDescriptor> = [
        { slot: LIF_SURROGATE_INTEGRATED_SLOT, optional: false, type: "lif-surrogate-integrated", kind: "stream", capacity: 1024 },
    ];
    public readonly outputPorts: ReadonlyArray<IPortDescriptor> = [
        { slot: LIF_SURROGATE_DECISION_SLOT, optional: true, type: "lif-surrogate-decision", kind: "stream", capacity: 1024 },
        { slot: LIF_SURROGATE_SPIKE_SLOT, optional: true, type: "spike", kind: "stream", capacity: 1024 },
    ];

    @cloneable public groupId: string = "";
    @cloneable public threshold: number = DEFAULT_CONFIG.threshold;
    @cloneable public spikeAmplitude: number = DEFAULT_CONFIG.spikeAmplitude;
    @cloneable public surrogateSlope: number = DEFAULT_CONFIG.surrogateSlope;
    @cloneable public mode: LifSurrogateMode = DEFAULT_CONFIG.mode;

    public constructor(groupId: string = "", config: Partial<IConstrainedLifSurrogateConfig> = {}) {
        super();
        this.groupId = groupId;
        this.threshold = finiteOr(config.threshold, DEFAULT_CONFIG.threshold);
        this.spikeAmplitude = finiteOr(config.spikeAmplitude, DEFAULT_CONFIG.spikeAmplitude);
        this.surrogateSlope = positiveOr(config.surrogateSlope, DEFAULT_CONFIG.surrogateSlope);
        this.mode = normalizeMode(config.mode);
        this.type = "snn.lif-surrogate.threshold";
    }

    public override fire(session: ISession): void {
        const value = this.consumeLatest(session, LIF_SURROGATE_INTEGRATED_SLOT);
        if (!isIntegrated(value)) return;

        const hardSpike = value.canFire && value.state.membranePotential >= this.threshold;
        const probability = hardSpike ? 1 : 0;
        const derivative = value.canFire ? surrogateDerivative(value.state.membranePotential, this.threshold, this.surrogateSlope) : 0;
        const decision: ILifSurrogateDecision = {
            integrated: value,
            probability,
            derivative,
            hardSpike,
        };
        this.publishAll(session, LIF_SURROGATE_DECISION_SLOT, decision);

        if (!hardSpike) return;
        const spike: ISurrogateSpike = {
            timestamp: value.timestamp,
            amplitude: this.spikeAmplitude,
            source: this,
            probability,
            surrogateDerivative: derivative,
            hardSpike,
        };
        this.publishAll(session, LIF_SURROGATE_SPIKE_SLOT, spike);
    }
}

/** Third stage: exact hard reset. The surrogate exists only in the backward pass. */
export class LifSurrogateResetNode extends RuntimeNode implements IDeclaresPorts {
    public readonly inputPorts: ReadonlyArray<IPortDescriptor> = [
        { slot: LIF_SURROGATE_DECISION_SLOT, optional: false, type: "lif-surrogate-decision", kind: "stream", capacity: 1024 },
    ];
    public readonly outputPorts: ReadonlyArray<IPortDescriptor> = [{ slot: LIF_SURROGATE_STATE_SLOT, optional: true, type: "lif-surrogate-state", kind: "stream", capacity: 1 }];

    @cloneable public groupId: string = "";
    @cloneable public resetPotential: number = DEFAULT_CONFIG.resetPotential;
    @cloneable public mode: LifSurrogateMode = DEFAULT_CONFIG.mode;

    public constructor(groupId: string = "", config: Partial<IConstrainedLifSurrogateConfig> = {}) {
        super();
        this.groupId = groupId;
        this.resetPotential = finiteOr(config.resetPotential, DEFAULT_CONFIG.resetPotential);
        this.mode = normalizeMode(config.mode);
        this.type = "snn.lif-surrogate.reset";
    }

    public override fire(session: ISession): void {
        const value = this.consumeLatest(session, LIF_SURROGATE_DECISION_SLOT);
        if (!isDecision(value)) return;

        const source = value.integrated.state;
        const next: ILifSurrogateState = { ...source };
        if (value.hardSpike) {
            next.membranePotential = this.resetPotential;
            next.lastSpikeTime = value.integrated.timestamp;
            next.spikeCount += 1;
        }
        this.publishAll(session, LIF_SURROGATE_STATE_SLOT, next);
    }
}

/**
 * Logical three-node training subgraph. Its stages are ordinary RuntimeNodes
 * and its links are ordinary Channels, so callers add them directly to a
 * dynamic RuntimeGraph. The descriptor is retained only for constrained
 * parameter updates and the later graph rewrite.
 */
export class ConstrainedLifSurrogateSubgraph {
    public readonly integrate: LifSurrogateIntegrateNode;
    public readonly thresholdStage: LifSurrogateThresholdNode;
    public readonly reset: LifSurrogateResetNode;
    public readonly integratedLink: Channel<ILifSurrogateIntegrated>;
    public readonly decisionLink: Channel<ILifSurrogateDecision>;
    public readonly stateFeedbackLink: Channel<ILifSurrogateState>;

    public readonly nodes: ReadonlyArray<RuntimeNode>;
    public readonly links: ReadonlyArray<Channel>;

    public constructor(
        public readonly groupId: string,
        config: Partial<IConstrainedLifSurrogateConfig> = {}
    ) {
        if (!groupId) throw new Error("A constrained LIF surrogate requires a non-empty group id.");
        const normalized = normalizeConfig(config);
        this.integrate = new LifSurrogateIntegrateNode(groupId, normalized);
        this.thresholdStage = new LifSurrogateThresholdNode(groupId, normalized);
        this.reset = new LifSurrogateResetNode(groupId, normalized);

        this.integrate.id = groupId + ":integrate";
        this.thresholdStage.id = groupId + ":threshold";
        this.reset.id = groupId + ":reset";

        this.integratedLink = new Channel<ILifSurrogateIntegrated>(
            this.integrate,
            this.thresholdStage,
            LIF_SURROGATE_INTEGRATED_SLOT,
            false,
            undefined,
            true,
            LIF_SURROGATE_INTEGRATED_SLOT
        );
        this.decisionLink = new Channel<ILifSurrogateDecision>(this.thresholdStage, this.reset, LIF_SURROGATE_DECISION_SLOT, false, undefined, true, LIF_SURROGATE_DECISION_SLOT);
        this.stateFeedbackLink = new Channel(this.reset, this.integrate, LIF_SURROGATE_STATE_SLOT, true, initialState(normalized.initialPotential), true, LIF_SURROGATE_STATE_SLOT);

        this.nodes = [this.integrate, this.thresholdStage, this.reset];
        this.links = [this.integratedLink, this.decisionLink, this.stateFeedbackLink];
    }

    /** External spike synapses target this node on the `spike` slot. */
    public get inputNode(): LifSurrogateIntegrateNode {
        return this.integrate;
    }

    /** External spike synapses leave this node from the `spike` slot. */
    public get outputNode(): LifSurrogateThresholdNode {
        return this.thresholdStage;
    }

    public get config(): IConstrainedLifSurrogateConfig {
        return {
            restingPotential: this.integrate.restingPotential,
            initialPotential: this.integrate.initialPotential,
            threshold: this.thresholdStage.threshold,
            resetPotential: this.reset.resetPotential,
            membraneTimeConstant: this.integrate.membraneTimeConstant,
            spikeAmplitude: this.thresholdStage.spikeAmplitude,
            surrogateSlope: this.thresholdStage.surrogateSlope,
            mode: this.thresholdStage.mode,
        };
    }

    public configure(config: Partial<IConstrainedLifSurrogateConfig>): void {
        const normalized = normalizeConfig({ ...this.config, ...config });
        this.integrate.restingPotential = normalized.restingPotential;
        this.integrate.initialPotential = normalized.initialPotential;
        this.integrate.membraneTimeConstant = normalized.membraneTimeConstant;
        this.thresholdStage.threshold = normalized.threshold;
        this.thresholdStage.spikeAmplitude = normalized.spikeAmplitude;
        this.thresholdStage.surrogateSlope = normalized.surrogateSlope;
        this.thresholdStage.mode = normalized.mode;
        this.reset.resetPotential = normalized.resetPotential;
        this.reset.mode = normalized.mode;
        this.stateFeedbackLink.initialValue = initialState(normalized.initialPotential);
    }
}

export function surrogateProbability(membranePotential: number, threshold: number, slope: number): number {
    return stableSigmoid(positiveOr(slope, DEFAULT_CONFIG.surrogateSlope) * (membranePotential - threshold));
}

/**
 * Compact triangular surrogate derivative used only by backpropagation.
 * The forward value remains the exact binary threshold. With slope `k`, the
 * derivative is non-zero only within `1 / k` of the threshold and integrates
 * to one over that interval.
 */
export function surrogateDerivative(membranePotential: number, threshold: number, slope: number): number {
    const normalizedSlope = positiveOr(slope, DEFAULT_CONFIG.surrogateSlope);
    return normalizedSlope * Math.max(0, 1 - normalizedSlope * Math.abs(membranePotential - threshold));
}

function normalizeConfig(config: Partial<IConstrainedLifSurrogateConfig>): IConstrainedLifSurrogateConfig {
    return {
        restingPotential: finiteOr(config.restingPotential, DEFAULT_CONFIG.restingPotential),
        initialPotential: finiteOr(config.initialPotential, DEFAULT_CONFIG.initialPotential),
        threshold: finiteOr(config.threshold, DEFAULT_CONFIG.threshold),
        resetPotential: finiteOr(config.resetPotential, DEFAULT_CONFIG.resetPotential),
        membraneTimeConstant: positiveOr(config.membraneTimeConstant, DEFAULT_CONFIG.membraneTimeConstant),
        spikeAmplitude: finiteOr(config.spikeAmplitude, DEFAULT_CONFIG.spikeAmplitude),
        surrogateSlope: positiveOr(config.surrogateSlope, DEFAULT_CONFIG.surrogateSlope),
        mode: normalizeMode(config.mode),
    };
}

function initialState(initialPotential: number): ILifSurrogateState {
    return {
        membranePotential: initialPotential,
        lastUpdateTime: null,
        lastSpikeTime: null,
        spikeCount: 0,
    };
}

function advanceLeak(state: ILifSurrogateState, t: number, restingPotential: number, timeConstant: number): ILifSurrogateState {
    const next = { ...state };
    const previous = state.lastUpdateTime;
    if (previous === null || !Number.isFinite(previous) || t <= previous) {
        next.lastUpdateTime = t;
        return next;
    }
    const decay = Math.exp(-(t - previous) / timeConstant);
    next.membranePotential = restingPotential + (state.membranePotential - restingPotential) * decay;
    next.lastUpdateTime = t;
    return next;
}

function stableSigmoid(value: number): number {
    if (value >= 0) {
        const z = Math.exp(-value);
        return 1 / (1 + z);
    }
    const z = Math.exp(value);
    return z / (1 + z);
}

function finiteOr(value: number | undefined, fallback: number): number {
    return value !== undefined && Number.isFinite(value) ? value : fallback;
}

function positiveOr(value: number | undefined, fallback: number): number {
    return value !== undefined && Number.isFinite(value) && value > 0 ? value : fallback;
}

function normalizeMode(mode: LifSurrogateMode | undefined): LifSurrogateMode {
    return mode === "hard" ? "hard" : "training";
}

function isSpike(value: unknown): value is ISpike {
    if (!value || typeof value !== "object") return false;
    const candidate = value as Partial<ISpike>;
    return typeof candidate.timestamp === "number" && typeof candidate.amplitude === "number" && !!candidate.source;
}

function isSurrogateState(value: unknown): value is ILifSurrogateState {
    if (!value || typeof value !== "object") return false;
    const candidate = value as Partial<ILifSurrogateState>;
    return typeof candidate.membranePotential === "number" && typeof candidate.spikeCount === "number";
}

function isIntegrated(value: unknown): value is ILifSurrogateIntegrated {
    if (!value || typeof value !== "object") return false;
    const candidate = value as Partial<ILifSurrogateIntegrated>;
    return typeof candidate.timestamp === "number" && typeof candidate.receivedAmplitude === "number" && isSurrogateState(candidate.state);
}

function isDecision(value: unknown): value is ILifSurrogateDecision {
    if (!value || typeof value !== "object") return false;
    const candidate = value as Partial<ILifSurrogateDecision>;
    return typeof candidate.probability === "number" && typeof candidate.derivative === "number" && isIntegrated(candidate.integrated);
}
