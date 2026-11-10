import type { IIdentifiedSignalWindow, IIdentifiedWindowAdapter, IWindowIdentity } from "../dsp/windowing.interfaces";
import type { IWaveObservation } from "./snn/wave-spike.sensor";

export interface ISnnWindowInput {
    readonly identity: IWindowIdentity;
    readonly observations: ReadonlyArray<IWaveObservation>;
}

export interface IGruWindowInput {
    readonly identity: IWindowIdentity;
    readonly features: number[][];
}

/** Converts one identified window to observations accepted by WaveSpikeEncoder. */
export class SnnWindowAdapter implements IIdentifiedWindowAdapter<ISnnWindowInput> {
    public adapt(window: IIdentifiedSignalWindow): ISnnWindowInput {
        const lastIndex = window.samples.length - 1;
        return {
            identity: window.identity,
            observations: window.samples.map((sample, index) => ({
                timestamp: sample.sampleIndex / window.sampleRateHz,
                values: sample.values,
                frameEnd: index === lastIndex,
            })),
        };
    }
}

/** Converts the same identified window to the timestep features accepted by a GRU. */
export class GruWindowAdapter implements IIdentifiedWindowAdapter<IGruWindowInput> {
    public adapt(window: IIdentifiedSignalWindow): IGruWindowInput {
        return {
            identity: window.identity,
            features: window.samples.map((sample) => Array.from(sample.values)),
        };
    }
}
