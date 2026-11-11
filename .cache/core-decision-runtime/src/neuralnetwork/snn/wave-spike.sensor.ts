import type { IDeclaresPorts, INodeState, IPortDescriptor, ISession } from "../../execution/execution.interfaces";
import { RuntimeNode } from "../../execution/execution.node";
import { editable } from "../../graph/graph.editor";
import { cloneable } from "../../graph/graph.interfaces";
import type { ISpike } from "./spike.interfaces";

export const WAVE_SPIKE_SENSOR_TYPE_ID = "SNN:wave-spike-sensor";
export const WAVE_OBSERVATION_INPUT_SLOT = "observation";
export const WAVE_FRAME_END_OUTPUT_SLOT = "frame-end";

export type WaveSpikePolarity = "rising" | "falling";
export type WaveSpikePolarityMode = WaveSpikePolarity | "both";
export type WaveSpikeAmplitudeMode = "binary" | "normalized-peak";

/** One sampled observation presented to the sensor. */
export interface IWaveObservation {
    readonly timestamp: number;
    readonly values: ReadonlyArray<number>;
    readonly frameEnd?: boolean;
}

/**
 * One light IIR analysis band. A band is bound to one observation channel.
 * Its two possible output ports preserve half-cycle polarity and phase.
 */
export interface IWaveSpikeBandConfig {
    readonly id: string;
    readonly channel: number;
    readonly centerFrequencyHz: number;
    readonly bandwidthHz: number;
    readonly threshold: number;
    /** Optional ordered amplitude levels sharing the same IIR band state. */
    readonly thresholds?: ReadonlyArray<number>;
    readonly polarity?: WaveSpikePolarityMode;
    readonly amplitudeMode?: WaveSpikeAmplitudeMode;
    readonly spikeAmplitude?: number;
}

export interface IWaveSpikeSensorConfig {
    readonly sampleRateHz: number;
    readonly bands: ReadonlyArray<IWaveSpikeBandConfig>;
    readonly emitFrameEnd?: boolean;
    /** Include host-side wave diagnostics on emitted spikes. Disable for the smallest payload. */
    readonly diagnostics?: boolean;
}

/**
 * Derived phenotype of one physical sensor cell. The stored band parameters
 * remain the genotype; this descriptor makes its spectral and temporal limits
 * explicit for training, diagnostics and future topology mutation.
 */
export interface IWaveSensorCellDescriptor {
    readonly id: string;
    readonly responseKind: "iir-band-pass-phase-crossing";
    readonly channel: number;
    readonly sampleRateHz: number;
    readonly nyquistFrequencyHz: number;
    readonly centerFrequencyHz: number;
    readonly bandwidthHz: number;
    readonly nominalLowerFrequencyHz: number;
    readonly nominalUpperFrequencyHz: number;
    readonly qualityFactor: number;
    /** Approximate 1/e decay time of the resonant response. */
    readonly remanenceTimeConstantSeconds: number;
    /** Approximate time for the residual response to fall below two percent. */
    readonly settlingTimeSeconds: number;
    /** Approximate bandwidth available for changes in the cell response. */
    readonly maximumAdaptationFrequencyHz: number;
    readonly thresholds: ReadonlyArray<number>;
    readonly polarity: WaveSpikePolarityMode;
    readonly amplitudeMode: WaveSpikeAmplitudeMode;
    readonly outputSlots: ReadonlyArray<string>;
}

/** Port metadata keeps the frequency map in graph configuration, not in every MCU spike. */
export interface IWaveSpikePortDescriptor extends IPortDescriptor {
    readonly bandId: string;
    readonly channel: number;
    readonly centerFrequencyHz: number;
    readonly bandwidthHz: number;
    readonly polarity: WaveSpikePolarity;
    readonly thresholdLevel: number;
    readonly threshold: number;
}

export interface IWaveSpikeDiagnostics {
    readonly bandId: string;
    readonly channel: number;
    readonly centerFrequencyHz: number;
    readonly estimatedFrequencyHz: number | null;
    readonly bandwidthHz: number;
    readonly phaseRadians: number;
    readonly polarity: WaveSpikePolarity;
    readonly thresholdLevel: number;
    readonly threshold: number;
    readonly peakAmplitude: number;
    readonly halfWaveEnergy: number;
}

export interface IWaveSpike extends ISpike {
    readonly wave?: IWaveSpikeDiagnostics;
}

export interface IWaveSpikeEmission extends IWaveSpikeDiagnostics {
    readonly slot: string;
    readonly timestamp: number;
    readonly amplitude: number;
}

interface IWaveBandState {
    x1: number;
    x2: number;
    y1: number;
    y2: number;
    previousY: number;
    peakAmplitude: number;
    halfWaveEnergy: number;
    primed: boolean;
    initialized: boolean;
    lastRisingTime: number | null;
    lastFallingTime: number | null;
}

export interface IWaveSpikeEncoderState {
    readonly bands: IWaveBandState[];
    sampleCount: number;
    spikeCount: number;
    lastTimestamp: number | null;
}

export interface IWaveSpikeSensorState extends INodeState {
    encoder: IWaveSpikeEncoderState;
}

interface IBiquadCoefficients {
    readonly b0: number;
    readonly b1: number;
    readonly b2: number;
    readonly a1: number;
    readonly a2: number;
}

interface ICompiledWaveBand {
    readonly config: IWaveSpikeBandConfig;
    readonly coefficients: IBiquadCoefficients;
}

/**
 * Pure, allocation-light wave-to-spike kernel. It can be used by offline
 * training and by WaveSpikeSensorNode with exactly the same state equations.
 */
export class WaveSpikeEncoder {
    public readonly config: IWaveSpikeSensorConfig;
    public readonly outputPorts: ReadonlyArray<IWaveSpikePortDescriptor>;
    public readonly cells: ReadonlyArray<IWaveSensorCellDescriptor>;

    private readonly _bands: ReadonlyArray<ICompiledWaveBand>;

    public constructor(config: IWaveSpikeSensorConfig) {
        this.config = normalizeSensorConfig(config);
        this._bands = this.config.bands.map((band) => ({
            config: band,
            coefficients: bandPassCoefficients(this.config.sampleRateHz, band.centerFrequencyHz, band.bandwidthHz),
        }));
        this.outputPorts = Object.freeze(this.config.bands.flatMap((band) => portDescriptorsOf(band)));
        this.cells = Object.freeze(this.config.bands.map((band) => cellDescriptorOf(this.config.sampleRateHz, band)));
    }

    public createState(): IWaveSpikeEncoderState {
        return {
            bands: this._bands.map(() => createBandState()),
            sampleCount: 0,
            spikeCount: 0,
            lastTimestamp: null,
        };
    }

    public reset(state: IWaveSpikeEncoderState): void {
        state.bands.splice(0, state.bands.length, ...this._bands.map(() => createBandState()));
        state.sampleCount = 0;
        state.spikeCount = 0;
        state.lastTimestamp = null;
    }

    public encode(observation: IWaveObservation, state: IWaveSpikeEncoderState): IWaveSpikeEmission[] {
        if (!Number.isFinite(observation.timestamp)) throw new Error("WaveSpikeEncoder: observation timestamp must be finite.");
        if (state.lastTimestamp !== null && observation.timestamp <= state.lastTimestamp) {
            throw new Error("WaveSpikeEncoder: observation timestamps must be strictly increasing.");
        }

        const emissions: IWaveSpikeEmission[] = [];
        for (let index = 0; index < this._bands.length; index++) {
            const band = this._bands[index];
            const input = observation.values[band.config.channel];
            if (!Number.isFinite(input)) continue;
            const bandState = state.bands[index];
            if (!bandState.primed) {
                // Prime the delay line with the first level so a DC offset does
                // not create an artificial startup oscillation.
                bandState.x1 = input;
                bandState.x2 = input;
                bandState.primed = true;
                continue;
            }
            const y = filterSample(input, band.coefficients, bandState);
            if (!bandState.initialized) {
                bandState.initialized = true;
                bandState.previousY = y;
                bandState.peakAmplitude = Math.abs(y);
                bandState.halfWaveEnergy = y * y;
                continue;
            }

            const polarity = crossingPolarity(bandState.previousY, y);
            if (polarity !== null) {
                const peakAmplitude = bandState.peakAmplitude;
                const halfWaveEnergy = bandState.halfWaveEnergy;
                if (acceptsPolarity(band.config.polarity, polarity)) {
                    const lastCrossing = polarity === "rising" ? bandState.lastRisingTime : bandState.lastFallingTime;
                    const period = lastCrossing === null ? null : observation.timestamp - lastCrossing;
                    const estimatedFrequencyHz = period !== null && period > 0 ? 1 / period : null;
                    const thresholds = thresholdsOf(band.config);
                    for (let thresholdLevel = 0; thresholdLevel < thresholds.length; thresholdLevel++) {
                        const threshold = thresholds[thresholdLevel];
                        if (peakAmplitude < threshold) continue;
                        emissions.push({
                            slot: waveSpikeSlot(band.config.id, polarity, thresholds.length > 1 ? thresholdLevel : undefined),
                            timestamp: observation.timestamp,
                            amplitude: encodedAmplitude(band.config, peakAmplitude, threshold),
                            bandId: band.config.id,
                            channel: band.config.channel,
                            centerFrequencyHz: band.config.centerFrequencyHz,
                            estimatedFrequencyHz,
                            bandwidthHz: band.config.bandwidthHz,
                            phaseRadians: polarity === "rising" ? 0 : Math.PI,
                            polarity,
                            thresholdLevel,
                            threshold,
                            peakAmplitude,
                            halfWaveEnergy,
                        });
                        state.spikeCount++;
                    }
                }
                if (polarity === "rising") bandState.lastRisingTime = observation.timestamp;
                else bandState.lastFallingTime = observation.timestamp;
                bandState.peakAmplitude = Math.abs(y);
                bandState.halfWaveEnergy = y * y;
            } else {
                bandState.peakAmplitude = Math.max(bandState.peakAmplitude, Math.abs(y));
                bandState.halfWaveEnergy += y * y;
            }
            bandState.previousY = y;
        }
        state.sampleCount++;
        state.lastTimestamp = observation.timestamp;
        return emissions;
    }
}

/** Runtime wrapper that owns no dynamic encoder state outside Session. */
export class WaveSpikeSensorNode extends RuntimeNode implements IDeclaresPorts {
    public readonly inputPorts: ReadonlyArray<IPortDescriptor> = [
        {
            slot: WAVE_OBSERVATION_INPUT_SLOT,
            optional: true,
            type: "wave-observation",
            kind: "stream",
            capacity: 1024,
        },
    ];

    private _config: IWaveSpikeSensorConfig;
    private _configJson: string;
    private _encoder: WaveSpikeEncoder;
    private _outputPorts: ReadonlyArray<IPortDescriptor>;

    public constructor(config: IWaveSpikeSensorConfig = defaultSensorConfig()) {
        super();
        this.type = "snn.wave-spike-sensor";
        this._config = normalizeSensorConfig(config);
        this._configJson = JSON.stringify(this._config);
        this._encoder = new WaveSpikeEncoder(this._config);
        this._outputPorts = outputPortsOf(this._encoder, this._config.emitFrameEnd !== false);
    }

    @editable("wave-spike-sensor")
    public get config(): IWaveSpikeSensorConfig {
        return this._config;
    }

    public set config(value: IWaveSpikeSensorConfig) {
        this._config = normalizeSensorConfig(value);
        this._configJson = JSON.stringify(this._config);
        this._encoder = new WaveSpikeEncoder(this._config);
        this._outputPorts = outputPortsOf(this._encoder, this._config.emitFrameEnd !== false);
    }

    /** JSON storage proxy ensures GraphItem clone/load invokes the normalizing setter. */
    @cloneable
    public get configJson(): string {
        return this._configJson;
    }

    public set configJson(value: string) {
        if (typeof value !== "string") return;
        try {
            this.config = JSON.parse(value) as IWaveSpikeSensorConfig;
        } catch {
            return;
        }
    }

    public get encoder(): WaveSpikeEncoder {
        return this._encoder;
    }

    public get outputPorts(): ReadonlyArray<IPortDescriptor> {
        return this._outputPorts;
    }

    public createNodeState(): IWaveSpikeSensorState {
        return { linksReady: 0, encoder: this._encoder.createState() };
    }

    public override reset(session: ISession): void {
        const state = this.stateOf(session);
        if (state) this._encoder.reset(state.encoder);
    }

    public override fire(session: ISession, t: number): void {
        const state = this.stateOf(session);
        if (!state) return;
        for (const channel of this.inputChannels(WAVE_OBSERVATION_INPUT_SLOT)) {
            if (!channel.enabled) continue;
            const index = this.channelIndex(session, channel);
            if (index < 0) continue;
            while (session.linkStates[index].ready) {
                const observation = asWaveObservation(session.consume(index), t);
                if (!observation) continue;
                const emissions = this._encoder.encode(observation, state.encoder);
                for (const emission of emissions) {
                    const spike: IWaveSpike = {
                        timestamp: emission.timestamp,
                        amplitude: emission.amplitude,
                        source: this,
                        ...(this._config.diagnostics === false
                            ? {}
                            : {
                                  wave: {
                                      bandId: emission.bandId,
                                      channel: emission.channel,
                                      centerFrequencyHz: emission.centerFrequencyHz,
                                      estimatedFrequencyHz: emission.estimatedFrequencyHz,
                                      bandwidthHz: emission.bandwidthHz,
                                      phaseRadians: emission.phaseRadians,
                                      polarity: emission.polarity,
                                      thresholdLevel: emission.thresholdLevel,
                                      threshold: emission.threshold,
                                      peakAmplitude: emission.peakAmplitude,
                                      halfWaveEnergy: emission.halfWaveEnergy,
                                  },
                              }),
                    };
                    this.publishAll(session, emission.slot, spike);
                }
                if (observation.frameEnd && this._config.emitFrameEnd !== false) {
                    this.publishAll(session, WAVE_FRAME_END_OUTPUT_SLOT, {
                        timestamp: observation.timestamp,
                        amplitude: 1,
                        source: this,
                    } satisfies ISpike);
                }
            }
        }
    }

    public stateOf(session: ISession): IWaveSpikeSensorState | undefined {
        return session.nodeStateOf(this) as IWaveSpikeSensorState | undefined;
    }
}

export function waveSpikeSlot(bandId: string, polarity: WaveSpikePolarity, thresholdLevel?: number): string {
    const level = thresholdLevel === undefined ? "" : `:level-${Math.max(0, Math.floor(thresholdLevel))}`;
    return `wave:${bandId}:${polarity}${level}`;
}

function portDescriptorsOf(band: IWaveSpikeBandConfig): IWaveSpikePortDescriptor[] {
    const polarities: WaveSpikePolarity[] = band.polarity === "rising" ? ["rising"] : band.polarity === "falling" ? ["falling"] : ["rising", "falling"];
    const thresholds = thresholdsOf(band);
    return polarities.flatMap((polarity) =>
        thresholds.map((threshold, thresholdLevel) => ({
            slot: waveSpikeSlot(band.id, polarity, thresholds.length > 1 ? thresholdLevel : undefined),
            optional: true,
            type: "spike",
            kind: "stream",
            capacity: 1024,
            bandId: band.id,
            channel: band.channel,
            centerFrequencyHz: band.centerFrequencyHz,
            bandwidthHz: band.bandwidthHz,
            polarity,
            thresholdLevel,
            threshold,
        }))
    );
}

function outputPortsOf(encoder: WaveSpikeEncoder, emitFrameEnd: boolean): ReadonlyArray<IPortDescriptor> {
    return Object.freeze([
        ...encoder.outputPorts,
        ...(emitFrameEnd
            ? [
                  {
                      slot: WAVE_FRAME_END_OUTPUT_SLOT,
                      optional: true,
                      type: "spike",
                      kind: "stream" as const,
                      capacity: 16,
                  },
              ]
            : []),
    ]);
}

function cellDescriptorOf(sampleRateHz: number, band: IWaveSpikeBandConfig): IWaveSensorCellDescriptor {
    const thresholds = thresholdsOf(band);
    const remanenceTimeConstantSeconds = 1 / (Math.PI * band.bandwidthHz);
    return Object.freeze({
        id: band.id,
        responseKind: "iir-band-pass-phase-crossing",
        channel: band.channel,
        sampleRateHz,
        nyquistFrequencyHz: sampleRateHz / 2,
        centerFrequencyHz: band.centerFrequencyHz,
        bandwidthHz: band.bandwidthHz,
        nominalLowerFrequencyHz: Math.max(0, band.centerFrequencyHz - band.bandwidthHz / 2),
        nominalUpperFrequencyHz: Math.min(sampleRateHz / 2, band.centerFrequencyHz + band.bandwidthHz / 2),
        qualityFactor: band.centerFrequencyHz / band.bandwidthHz,
        remanenceTimeConstantSeconds,
        settlingTimeSeconds: 4 * remanenceTimeConstantSeconds,
        maximumAdaptationFrequencyHz: 1 / (2 * Math.PI * remanenceTimeConstantSeconds),
        thresholds,
        polarity: normalizePolarity(band.polarity),
        amplitudeMode: band.amplitudeMode === "normalized-peak" ? "normalized-peak" : "binary",
        outputSlots: Object.freeze(portDescriptorsOf(band).map((port) => String(port.slot))),
    });
}

function normalizeSensorConfig(config: IWaveSpikeSensorConfig): IWaveSpikeSensorConfig {
    const sampleRateHz = positiveFinite(config?.sampleRateHz, 1);
    const bands = Array.isArray(config?.bands) ? config.bands : [];
    const seen = new Set<string>();
    const normalizedBands = bands.map((band, index) => {
        const id = String(band.id || `band-${index}`);
        if (seen.has(id)) throw new Error(`WaveSpikeEncoder: duplicate band id '${id}'.`);
        seen.add(id);
        const centerFrequencyHz = positiveFinite(band.centerFrequencyHz, sampleRateHz / 4);
        if (centerFrequencyHz >= sampleRateHz / 2) {
            throw new Error(`WaveSpikeEncoder: band '${id}' must be below Nyquist (${sampleRateHz / 2} Hz).`);
        }
        const thresholds = normalizeThresholds(band.thresholds, band.threshold);
        return Object.freeze({
            id,
            channel: Math.max(0, Math.floor(finiteOr(band.channel, 0))),
            centerFrequencyHz,
            bandwidthHz: positiveFinite(band.bandwidthHz, centerFrequencyHz / 2),
            threshold: thresholds[0],
            thresholds,
            polarity: normalizePolarity(band.polarity),
            amplitudeMode: band.amplitudeMode === "normalized-peak" ? "normalized-peak" : "binary",
            spikeAmplitude: finiteOr(band.spikeAmplitude, 1),
        } satisfies IWaveSpikeBandConfig);
    });
    return Object.freeze({
        sampleRateHz,
        bands: Object.freeze(normalizedBands),
        emitFrameEnd: config?.emitFrameEnd !== false,
        diagnostics: config?.diagnostics !== false,
    });
}

function defaultSensorConfig(): IWaveSpikeSensorConfig {
    return { sampleRateHz: 1000, bands: [], emitFrameEnd: true, diagnostics: true };
}

function normalizePolarity(value: WaveSpikePolarityMode | undefined): WaveSpikePolarityMode {
    return value === "rising" || value === "falling" ? value : "both";
}

function bandPassCoefficients(sampleRateHz: number, centerFrequencyHz: number, bandwidthHz: number): IBiquadCoefficients {
    const omega = (2 * Math.PI * centerFrequencyHz) / sampleRateHz;
    const q = Math.max(1e-6, centerFrequencyHz / bandwidthHz);
    const alpha = Math.sin(omega) / (2 * q);
    const a0 = 1 + alpha;
    return {
        b0: alpha / a0,
        b1: 0,
        b2: -alpha / a0,
        a1: (-2 * Math.cos(omega)) / a0,
        a2: (1 - alpha) / a0,
    };
}

function filterSample(input: number, coefficients: IBiquadCoefficients, state: IWaveBandState): number {
    const output = coefficients.b0 * input + coefficients.b1 * state.x1 + coefficients.b2 * state.x2 - coefficients.a1 * state.y1 - coefficients.a2 * state.y2;
    state.x2 = state.x1;
    state.x1 = input;
    state.y2 = state.y1;
    state.y1 = output;
    return output;
}

function createBandState(): IWaveBandState {
    return {
        x1: 0,
        x2: 0,
        y1: 0,
        y2: 0,
        previousY: 0,
        peakAmplitude: 0,
        halfWaveEnergy: 0,
        primed: false,
        initialized: false,
        lastRisingTime: null,
        lastFallingTime: null,
    };
}

function crossingPolarity(previous: number, current: number): WaveSpikePolarity | null {
    if (previous <= 0 && current > 0) return "rising";
    if (previous >= 0 && current < 0) return "falling";
    return null;
}

function acceptsPolarity(mode: WaveSpikePolarityMode | undefined, polarity: WaveSpikePolarity): boolean {
    return mode === undefined || mode === "both" || mode === polarity;
}

function encodedAmplitude(config: IWaveSpikeBandConfig, peakAmplitude: number, threshold: number): number {
    const base = finiteOr(config.spikeAmplitude, 1);
    if (config.amplitudeMode !== "normalized-peak") return base;
    return base * (peakAmplitude / Math.max(threshold, 1e-12));
}

function normalizeThresholds(values: ReadonlyArray<number> | undefined, fallback: number): ReadonlyArray<number> {
    const candidates = Array.isArray(values) && values.length > 0 ? values : [fallback];
    const normalized = candidates
        .filter((value) => Number.isFinite(value))
        .map((value) => Math.max(0, value))
        .sort((left, right) => left - right)
        .filter((value, index, array) => index === 0 || value !== array[index - 1]);
    return Object.freeze(normalized.length > 0 ? normalized : [Math.max(0, finiteOr(fallback, 0))]);
}

function thresholdsOf(config: IWaveSpikeBandConfig): ReadonlyArray<number> {
    return config.thresholds && config.thresholds.length > 0 ? config.thresholds : [config.threshold];
}

function asWaveObservation(value: unknown, fallbackTimestamp: number): IWaveObservation | null {
    if (Array.isArray(value)) return { timestamp: fallbackTimestamp, values: value as number[] };
    if (!value || typeof value !== "object") return null;
    const candidate = value as Partial<IWaveObservation>;
    if (!Array.isArray(candidate.values)) return null;
    return {
        timestamp: Number.isFinite(candidate.timestamp) ? (candidate.timestamp as number) : fallbackTimestamp,
        values: candidate.values,
        frameEnd: candidate.frameEnd === true,
    };
}

function finiteOr(value: number | undefined, fallback: number): number {
    return Number.isFinite(value) ? (value as number) : fallback;
}

function positiveFinite(value: number | undefined, fallback: number): number {
    return Number.isFinite(value) && (value as number) > 0 ? (value as number) : fallback;
}
