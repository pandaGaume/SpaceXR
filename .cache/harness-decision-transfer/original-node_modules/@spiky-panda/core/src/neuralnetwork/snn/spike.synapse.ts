import { Channel } from "../../execution/execution.channel";
import type { IChannelDelivery, ISession } from "../../execution/execution.interfaces";
import { editable } from "../../graph/graph.editor";
import { cloneable, type INode } from "../../graph/graph.interfaces";
import type { ISpike, ISpikeSynapse } from "./spike.interfaces";

export const SPIKE_SYNAPSE_TYPE_ID = "SNN:spike-synapse";

/**
 * Session-native weighted and delayed spike channel.
 *
 * `Session.publish` calls `prepareDelivery` before queueing the event. This
 * keeps weight and delay semantics on the edge itself, regardless of which
 * runtime node emitted the spike.
 */
export class SpikeSynapse extends Channel<ISpike> implements ISpikeSynapse {
    private _weight: number = 1;
    private _delay: number = 0;
    private _plasticity: boolean = false;

    public constructor(
        oini?: INode,
        ofin?: INode,
        slot: string | number = "spike",
        toSlot: string | number = "spike",
        weight: number = 1,
        delay: number = 0,
        enabled: boolean = true
    ) {
        super(oini, ofin, slot, false, undefined, enabled, toSlot);
        this._weight = Number.isFinite(weight) ? weight : 1;
        this._delay = normalizeDelay(delay);
        this.type = "snn.spike-synapse";
    }

    @cloneable
    @editable("number")
    public get weight(): number {
        return this._weight;
    }
    public set weight(value: number) {
        if (!Number.isFinite(value)) return;
        this.setField("weight", this._weight, value, (next) => {
            this._weight = next;
        });
    }

    /** Integer scheduler-tick delay. Zero delivers in the current dispatch. */
    @cloneable
    @editable("int", { min: 0, unit: { quantity: "Timespan", unit: "tick" } })
    public get delay(): number {
        return this._delay;
    }
    public set delay(value: number) {
        const next = normalizeDelay(value);
        this.setField("delay", this._delay, next, (normalized) => {
            this._delay = normalized;
        });
    }

    @cloneable
    @editable("boolean")
    public get plasticity(): boolean {
        return this._plasticity;
    }
    public set plasticity(value: boolean) {
        this.setField("plasticity", this._plasticity, !!value, (next) => {
            this._plasticity = next;
        });
    }

    public prepareDelivery(value: ISpike, session: ISession): IChannelDelivery<ISpike> | null {
        if (!isSpike(value)) return null;
        return {
            value: { ...value, amplitude: value.amplitude * this._weight },
            ...(this._delay > 0 ? { validAtTick: session.tickIndex + this._delay } : {}),
        };
    }
}

function normalizeDelay(value: number): number {
    return Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0;
}

function isSpike(value: unknown): value is ISpike {
    if (!value || typeof value !== "object") return false;
    const candidate = value as Partial<ISpike>;
    return typeof candidate.timestamp === "number" && typeof candidate.amplitude === "number" && !!candidate.source;
}
