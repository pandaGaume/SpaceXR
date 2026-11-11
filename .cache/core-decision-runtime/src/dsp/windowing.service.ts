import type {
    IIdentifiedSignalWindow,
    IRawSignalSample,
    IResolvedWindowingServiceConfig,
    IWindowingService,
    IWindowingServiceConfig,
    IWindowingServiceState,
} from "./windowing.interfaces";

/**
 * Allocation-bounded sliding-window service for uniformly sampled signals.
 *
 * Window size and stride are physical parameters. Window size fixes the
 * observation horizon. Stride fixes the decision-time resolution and motif
 * alignment. Neither value should be selected only to change dataset volume.
 */
export class WindowingService implements IWindowingService {
    public readonly config: Readonly<IResolvedWindowingServiceConfig>;

    private readonly _buffer: IRawSignalSample[] = [];
    private _acquisitionId: string | null = null;
    private _lastSampleIndex: number | null = null;
    private _nextWindowIndex = 0;

    private constructor(config: IWindowingServiceConfig) {
        WindowingService._validateConfig(config);
        this.config = Object.freeze({
            ...config,
            discontinuityPolicy: config.discontinuityPolicy ?? "reset",
        });
    }

    /** Creates the default implementation while exposing only its portable contract. */
    public static create(config: IWindowingServiceConfig): IWindowingService {
        return new WindowingService(config);
    }

    public get state(): IWindowingServiceState {
        return {
            acquisitionId: this._acquisitionId,
            lastSampleIndex: this._lastSampleIndex,
            bufferedSampleCount: this._buffer.length,
            nextWindowIndex: this._nextWindowIndex,
        };
    }

    public push(sample: IRawSignalSample): IIdentifiedSignalWindow | null {
        WindowingService._validateSample(sample, this.config.channelCount);

        if (this._acquisitionId !== sample.acquisitionId) {
            this._startAcquisition(sample.acquisitionId);
        } else if (this._lastSampleIndex !== null && sample.sampleIndex !== this._lastSampleIndex + 1) {
            this._handleDiscontinuity(sample.sampleIndex);
        }

        const storedSample: IRawSignalSample = Object.freeze({
            acquisitionId: sample.acquisitionId,
            sampleIndex: sample.sampleIndex,
            values: Object.freeze(Array.from(sample.values)),
        });
        this._buffer.push(storedSample);
        this._lastSampleIndex = storedSample.sampleIndex;

        if (this._buffer.length < this.config.windowSize) return null;

        const samples = Object.freeze(this._buffer.slice());
        const first = samples[0];
        const last = samples[samples.length - 1];
        const window: IIdentifiedSignalWindow = Object.freeze({
            identity: Object.freeze({
                acquisitionId: first.acquisitionId,
                windowIndex: this._nextWindowIndex,
                startSampleIndex: first.sampleIndex,
                endSampleIndex: last.sampleIndex,
            }),
            windowSize: this.config.windowSize,
            stride: this.config.stride,
            channelCount: this.config.channelCount,
            sampleRateHz: this.config.sampleRateHz,
            samples,
        });

        this._nextWindowIndex++;
        this._buffer.splice(0, this.config.stride);
        return window;
    }

    public reset(): void {
        this._buffer.length = 0;
        this._acquisitionId = null;
        this._lastSampleIndex = null;
        this._nextWindowIndex = 0;
    }

    private _startAcquisition(acquisitionId: string): void {
        this._buffer.length = 0;
        this._acquisitionId = acquisitionId;
        this._lastSampleIndex = null;
        this._nextWindowIndex = 0;
    }

    private _handleDiscontinuity(receivedSampleIndex: number): void {
        if (this.config.discontinuityPolicy === "reject") {
            throw new Error(`WindowingService: expected sample ${Number(this._lastSampleIndex) + 1}, received ${receivedSampleIndex} for acquisition ${this._acquisitionId}.`);
        }

        this._buffer.length = 0;
        this._lastSampleIndex = null;
    }

    private static _validateConfig(config: IWindowingServiceConfig): void {
        WindowingService._requirePositiveInteger(config.windowSize, "windowSize");
        WindowingService._requirePositiveInteger(config.stride, "stride");
        WindowingService._requirePositiveInteger(config.channelCount, "channelCount");
        if (config.stride > config.windowSize) throw new Error("WindowingService: stride cannot exceed windowSize.");
        if (!Number.isFinite(config.sampleRateHz) || config.sampleRateHz <= 0) {
            throw new Error("WindowingService: sampleRateHz must be finite and positive.");
        }
        if (config.discontinuityPolicy !== undefined && config.discontinuityPolicy !== "reset" && config.discontinuityPolicy !== "reject") {
            throw new Error("WindowingService: discontinuityPolicy must be reset or reject.");
        }
    }

    private static _validateSample(sample: IRawSignalSample, channelCount: number): void {
        if (typeof sample.acquisitionId !== "string" || sample.acquisitionId.trim().length === 0) {
            throw new Error("WindowingService: acquisitionId must be a non-empty string.");
        }
        if (!Number.isSafeInteger(sample.sampleIndex) || sample.sampleIndex < 0) {
            throw new Error("WindowingService: sampleIndex must be a non-negative safe integer.");
        }
        if (!sample.values || sample.values.length !== channelCount) {
            throw new Error(`WindowingService: expected ${channelCount} channels, received ${sample.values?.length ?? 0}.`);
        }
        for (const value of sample.values) {
            if (!Number.isFinite(value)) throw new Error("WindowingService: channel values must be finite.");
        }
    }

    private static _requirePositiveInteger(value: number, name: string): void {
        if (!Number.isSafeInteger(value) || value <= 0) throw new Error(`WindowingService: ${name} must be a positive integer.`);
    }
}
