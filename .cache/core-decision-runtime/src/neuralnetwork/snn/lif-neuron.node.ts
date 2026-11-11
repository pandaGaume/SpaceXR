import type { IDeclaresPorts, INodeState, IPortDescriptor, ISession } from "../../execution/execution.interfaces";
import { RuntimeNode } from "../../execution/execution.node";
import { editable } from "../../graph/graph.editor";
import { cloneable } from "../../graph/graph.interfaces";
import type { ISpike } from "./spike.interfaces";

export const LIF_NEURON_TYPE_ID = "SNN:lif-neuron";
export const SPIKE_INPUT_SLOT = "spike";
export const SPIKE_OUTPUT_SLOT = "spike";

export interface ILifNeuronState extends INodeState {
    membranePotential: number;
    lastUpdateTime: number | null;
    lastSpikeTime: number | null;
    spikeCount: number;
}

/**
 * Event-driven Leaky Integrate-and-Fire neuron hosted by `Session`.
 * Dynamic membrane state is allocated per session; the node instance holds
 * only persistent model parameters and can safely be shared by many sessions.
 */
export class LifNeuronNode extends RuntimeNode implements IDeclaresPorts {
    public readonly inputPorts: ReadonlyArray<IPortDescriptor> = [{ slot: SPIKE_INPUT_SLOT, optional: true, gating: false, kind: "stream", capacity: 1024, type: "spike" }];
    public readonly outputPorts: ReadonlyArray<IPortDescriptor> = [{ slot: SPIKE_OUTPUT_SLOT, optional: true, kind: "stream", capacity: 1024, type: "spike" }];

    private _restingPotential: number = 0;
    private _initialPotential: number = 0;
    private _threshold: number = 1;
    private _resetPotential: number = 0;
    private _membraneTimeConstant: number = 0.02;
    private _refractoryPeriod: number = 0;
    private _spikeAmplitude: number = 1;

    @cloneable
    @editable("number", { unit: { quantity: "Voltage", unit: "volt" } })
    public get restingPotential(): number {
        return this._restingPotential;
    }
    public set restingPotential(value: number) {
        this.setFiniteField("restingPotential", this._restingPotential, value, (next) => (this._restingPotential = next));
    }

    @cloneable
    @editable("number", { unit: { quantity: "Voltage", unit: "volt" } })
    public get initialPotential(): number {
        return this._initialPotential;
    }
    public set initialPotential(value: number) {
        this.setFiniteField("initialPotential", this._initialPotential, value, (next) => (this._initialPotential = next));
    }

    @cloneable
    @editable("number", { unit: { quantity: "Voltage", unit: "volt" } })
    public get threshold(): number {
        return this._threshold;
    }
    public set threshold(value: number) {
        this.setFiniteField("threshold", this._threshold, value, (next) => (this._threshold = next));
    }

    @cloneable
    @editable("number", { unit: { quantity: "Voltage", unit: "volt" } })
    public get resetPotential(): number {
        return this._resetPotential;
    }
    public set resetPotential(value: number) {
        this.setFiniteField("resetPotential", this._resetPotential, value, (next) => (this._resetPotential = next));
    }

    @cloneable
    @editable("number", { min: 1e-9, unit: { quantity: "Timespan", unit: "s" } })
    public get membraneTimeConstant(): number {
        return this._membraneTimeConstant;
    }
    public set membraneTimeConstant(value: number) {
        if (!Number.isFinite(value) || value <= 0) return;
        this.setField("membraneTimeConstant", this._membraneTimeConstant, value, (next) => (this._membraneTimeConstant = next));
    }

    @cloneable
    @editable("number", { min: 0, unit: { quantity: "Timespan", unit: "s" } })
    public get refractoryPeriod(): number {
        return this._refractoryPeriod;
    }
    public set refractoryPeriod(value: number) {
        if (!Number.isFinite(value)) return;
        const next = Math.max(0, value);
        this.setField("refractoryPeriod", this._refractoryPeriod, next, (normalized) => (this._refractoryPeriod = normalized));
    }

    @cloneable
    @editable("number")
    public get spikeAmplitude(): number {
        return this._spikeAmplitude;
    }
    public set spikeAmplitude(value: number) {
        this.setFiniteField("spikeAmplitude", this._spikeAmplitude, value, (next) => (this._spikeAmplitude = next));
    }

    public createNodeState(): ILifNeuronState {
        return {
            linksReady: 0,
            membranePotential: this._initialPotential,
            lastUpdateTime: null,
            lastSpikeTime: null,
            spikeCount: 0,
        };
    }

    public override reset(session: ISession): void {
        const state = this.stateOf(session);
        if (!state) return;
        state.membranePotential = this._initialPotential;
        state.lastUpdateTime = null;
        state.lastSpikeTime = null;
        state.spikeCount = 0;
    }

    public override fire(session: ISession, t: number): void {
        const state = this.stateOf(session);
        if (!state) return;
        this.advanceLeak(state, t);

        let receivedAmplitude = 0;
        for (const channel of this.inputChannels(SPIKE_INPUT_SLOT)) {
            if (!channel.enabled) continue;
            const index = this.channelIndex(session, channel);
            if (index < 0) continue;
            while (session.linkStates[index].ready) {
                const spike = session.consume(index);
                if (isSpike(spike)) receivedAmplitude += spike.amplitude;
            }
        }

        if (receivedAmplitude === 0) return;
        if (state.lastSpikeTime !== null && t < state.lastSpikeTime + this._refractoryPeriod) {
            state.membranePotential = this._resetPotential;
            return;
        }

        state.membranePotential += receivedAmplitude;
        if (state.membranePotential < this._threshold) return;

        const spike: ISpike = {
            timestamp: t,
            amplitude: this._spikeAmplitude,
            source: this,
        };
        state.lastSpikeTime = t;
        state.lastUpdateTime = t;
        state.spikeCount++;
        state.membranePotential = this._resetPotential;
        this.publishAll(session, SPIKE_OUTPUT_SLOT, spike);
    }

    /** Read this neuron's state in a specific session for tests and probes. */
    public stateOf(session: ISession): ILifNeuronState | undefined {
        return session.nodeStateOf(this) as ILifNeuronState | undefined;
    }

    private advanceLeak(state: ILifNeuronState, t: number): void {
        const previous = state.lastUpdateTime;
        if (previous === null || !Number.isFinite(previous) || t <= previous) {
            state.lastUpdateTime = t;
            return;
        }

        let start = previous;
        if (state.lastSpikeTime !== null) {
            const refractoryUntil = state.lastSpikeTime + this._refractoryPeriod;
            if (t <= refractoryUntil) {
                state.membranePotential = this._resetPotential;
                state.lastUpdateTime = t;
                return;
            }
            if (start < refractoryUntil) start = refractoryUntil;
        }

        const decay = Math.exp(-(t - start) / this._membraneTimeConstant);
        state.membranePotential = this._restingPotential + (state.membranePotential - this._restingPotential) * decay;
        state.lastUpdateTime = t;
    }

    private setFiniteField(name: string, current: number, value: number, writer: (next: number) => void): void {
        if (!Number.isFinite(value)) return;
        this.setField(name, current, value, writer);
    }
}

function isSpike(value: unknown): value is ISpike {
    if (!value || typeof value !== "object") return false;
    const candidate = value as Partial<ISpike>;
    return typeof candidate.amplitude === "number" && typeof candidate.timestamp === "number" && !!candidate.source;
}
