import { BrowserImageDecoder, type IImageDecoder } from "@spacexr/raster";

import { createHeightGrid, decodeHeightGrid, type DemEncoding, type IDecodeHeightGridOptions, type IHeightGrid } from "./dem";

/** Options of {@link IDemDecoder.decodeDem}. */
export interface IDemDecodeOptions extends IDecodeHeightGridOptions {
    signal?: AbortSignal;
}

/**
 * Port decoding the encoded image bytes of a DEM tile into a height grid.
 *
 * {@link LocalDemDecoder} decodes on the calling thread; {@link WorkerDemDecoder} delegates to web workers so that
 * image decoding does not block rendering.
 */
export interface IDemDecoder {
    /**
     * Decodes one tile. The decoder may transfer `bytes` to another thread, after which the caller must not use them.
     */
    decodeDem(bytes: Uint8Array, encoding: DemEncoding, options?: IDemDecodeOptions): Promise<IHeightGrid>;
}

/** Decodes DEM tiles on the calling thread. Suitable for tests, Node.js and workers. */
export class LocalDemDecoder implements IDemDecoder {
    public constructor(private readonly imageDecoder: IImageDecoder = new BrowserImageDecoder()) {}

    public async decodeDem(bytes: Uint8Array, encoding: DemEncoding, options: IDemDecodeOptions = {}): Promise<IHeightGrid> {
        const image = await this.imageDecoder.decode(bytes, options.signal);
        options.signal?.throwIfAborted();
        return decodeHeightGrid(image, encoding, options);
    }
}

/** Request sent to a DEM decoder worker. `bytes` is transferred. */
export interface IDemDecodeRequest {
    id: number;
    bytes: Uint8Array;
    encoding: DemEncoding;
    transparentAsNoData?: boolean;
}

/** Response of a DEM decoder worker. `data`, the heights, is transferred. */
export type DemDecodeResponse = { id: number; width: number; height: number; data: Float32Array } | { id: number; error: string };

/** Message endpoint of a worker scope, such as `self` in a dedicated worker. */
export interface IDemWorkerScope {
    addEventListener(type: "message", listener: (event: MessageEvent<IDemDecodeRequest>) => void): void;
    postMessage(message: DemDecodeResponse, transfer: Transferable[]): void;
    /** Present on `MessagePort`, which only delivers messages once started. */
    start?(): void;
}

/**
 * Serves DEM decode requests inside a worker.
 *
 * Call it from the worker module of the application, for example `installDemDecoderWorker(self)`. The worker decodes
 * the image and the elevations, then transfers the heights back without copying them.
 */
export function installDemDecoderWorker(scope: IDemWorkerScope, decoder: IDemDecoder = new LocalDemDecoder()): void {
    scope.addEventListener("message", (event) => {
        const { id, bytes, encoding, transparentAsNoData } = event.data;
        const options = transparentAsNoData === undefined ? {} : { transparentAsNoData };
        decoder.decodeDem(bytes, encoding, options).then(
            (grid) => scope.postMessage({ id, width: grid.width, height: grid.height, data: grid.data }, [grid.data.buffer]),
            (error: unknown) => scope.postMessage({ id, error: error instanceof Error ? error.message : String(error) }, [])
        );
    });
    scope.start?.();
}

/** Worker, or any port exchanging {@link IDemDecodeRequest} and {@link DemDecodeResponse} messages. */
export interface IDemWorkerEndpoint {
    postMessage(message: IDemDecodeRequest, transfer: Transferable[]): void;
    addEventListener(type: "message", listener: (event: MessageEvent<DemDecodeResponse>) => void): void;
    addEventListener(type: "error", listener: (event: Event) => void): void;
    /** Present on `MessagePort`, which only delivers messages once started. */
    start?(): void;
    terminate?(): void;
}

interface IPendingDecode {
    resolve: (grid: IHeightGrid) => void;
    reject: (reason: unknown) => void;
    signal: AbortSignal | undefined;
    onAbort: () => void;
}

interface IWorkerState {
    endpoint: IDemWorkerEndpoint;
    pending: Map<number, IPendingDecode>;
}

/**
 * Decodes DEM tiles in a pool of workers running {@link installDemDecoderWorker}.
 *
 * Each request goes to the worker with the fewest pending requests. The tile bytes are transferred to the worker and the
 * heights are transferred back, so neither is copied. Aborting a request settles it immediately; the worker still
 * finishes it and its result is dropped. A worker error rejects every request pending on that worker.
 */
export class WorkerDemDecoder implements IDemDecoder {
    private readonly workers: IWorkerState[];
    private nextId = 1;

    public constructor(workers: IDemWorkerEndpoint | readonly IDemWorkerEndpoint[]) {
        const endpoints = Array.isArray(workers) ? [...(workers as readonly IDemWorkerEndpoint[])] : [workers as IDemWorkerEndpoint];
        if (endpoints.length === 0) throw new RangeError("WorkerDemDecoder requires at least one worker.");
        this.workers = endpoints.map((endpoint) => {
            const state: IWorkerState = { endpoint, pending: new Map() };
            endpoint.addEventListener("message", (event: MessageEvent<DemDecodeResponse>) => this.settle(state, event.data));
            endpoint.addEventListener("error", (event: Event) => this.failAll(state, event));
            endpoint.start?.();
            return state;
        });
    }

    /** Number of requests waiting for a worker response. */
    public get pendingCount(): number {
        return this.workers.reduce((count, state) => count + state.pending.size, 0);
    }

    public decodeDem(bytes: Uint8Array, encoding: DemEncoding, options: IDemDecodeOptions = {}): Promise<IHeightGrid> {
        const { signal } = options;
        if (signal?.aborted) return Promise.reject(signal.reason);
        const state = this.workers.reduce((best, candidate) => (candidate.pending.size < best.pending.size ? candidate : best));
        const id = this.nextId++;
        // Transfer a buffer that holds exactly the tile bytes; a view over a larger or shared buffer is copied first.
        const transferable = bytes.byteOffset === 0 && bytes.byteLength === bytes.buffer.byteLength && bytes.buffer instanceof ArrayBuffer ? bytes : bytes.slice();
        return new Promise<IHeightGrid>((resolve, reject) => {
            const onAbort = (): void => {
                state.pending.delete(id);
                reject(signal!.reason);
            };
            state.pending.set(id, { resolve, reject, signal, onAbort });
            signal?.addEventListener("abort", onAbort, { once: true });
            const request: IDemDecodeRequest = {
                id,
                bytes: transferable,
                encoding,
                ...(options.transparentAsNoData === undefined ? {} : { transparentAsNoData: options.transparentAsNoData }),
            };
            state.endpoint.postMessage(request, [transferable.buffer as ArrayBuffer]);
        });
    }

    /** Rejects pending requests and terminates the workers that support it. */
    public terminate(): void {
        for (const state of this.workers) {
            this.failAll(state, new Error("WorkerDemDecoder was terminated."));
            state.endpoint.terminate?.();
        }
    }

    private settle(state: IWorkerState, response: DemDecodeResponse): void {
        const pending = state.pending.get(response.id);
        if (!pending) return;
        state.pending.delete(response.id);
        pending.signal?.removeEventListener("abort", pending.onAbort);
        if ("error" in response) pending.reject(new Error(response.error));
        else pending.resolve(createHeightGrid(response.width, response.height, response.data));
    }

    private failAll(state: IWorkerState, reason: unknown): void {
        const error = reason instanceof Error ? reason : new Error("A DEM decoder worker failed.", { cause: reason });
        for (const pending of state.pending.values()) {
            pending.signal?.removeEventListener("abort", pending.onAbort);
            pending.reject(error);
        }
        state.pending.clear();
    }
}
