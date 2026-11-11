/** A uniformly sampled multi-channel observation from one acquisition. */
export interface IRawSignalSample {
    /** Stable identifier of the physical acquisition or live stream. */
    readonly acquisitionId: string;
    /** Zero-based or absolute sample index within the acquisition. */
    readonly sampleIndex: number;
    /** Channel values in a stable, application-defined order. */
    readonly values: ReadonlyArray<number>;
}

/** Stable provenance for a window. The end sample index is inclusive. */
export interface IWindowIdentity {
    readonly acquisitionId: string;
    readonly windowIndex: number;
    readonly startSampleIndex: number;
    readonly endSampleIndex: number;
}

/** A complete window emitted by an IWindowingService. */
export interface IIdentifiedSignalWindow {
    readonly identity: IWindowIdentity;
    readonly windowSize: number;
    readonly stride: number;
    readonly channelCount: number;
    readonly sampleRateHz: number;
    readonly samples: ReadonlyArray<IRawSignalSample>;
}

export type WindowDiscontinuityPolicy = "reset" | "reject";

export interface IWindowingServiceConfig {
    /** Physical observation horizon, expressed as a sample count. */
    readonly windowSize: number;
    /** Physical decision interval, expressed as a sample count. */
    readonly stride: number;
    readonly channelCount: number;
    readonly sampleRateHz: number;
    /** Behavior when one or more sample indices are missing. Defaults to reset. */
    readonly discontinuityPolicy?: WindowDiscontinuityPolicy;
}

export interface IResolvedWindowingServiceConfig extends IWindowingServiceConfig {
    readonly discontinuityPolicy: WindowDiscontinuityPolicy;
}

/** Read-only diagnostic state. It is not required to restore the service. */
export interface IWindowingServiceState {
    readonly acquisitionId: string | null;
    readonly lastSampleIndex: number | null;
    readonly bufferedSampleCount: number;
    readonly nextWindowIndex: number;
}

/**
 * Portable streaming contract intended to have the same shape in TypeScript
 * and CyanMycelium C++. One pushed sample can complete at most one window.
 */
export interface IWindowingService {
    readonly config: Readonly<IResolvedWindowingServiceConfig>;
    readonly state: IWindowingServiceState;

    push(sample: IRawSignalSample): IIdentifiedSignalWindow | null;
    reset(): void;
}

/** Common downstream contract for model-specific window representations. */
export interface IIdentifiedWindowAdapter<TOutput> {
    adapt(window: IIdentifiedSignalWindow): TOutput;
}
