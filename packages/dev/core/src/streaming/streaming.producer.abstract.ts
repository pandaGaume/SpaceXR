import { IMemoryCache, MemoryCache } from "../cache/cache";
import { EventState } from "../events";
import { SourceBlock } from "../tiles/pipeline/tiles.pipeline.sourceblock";
import { IPipelineMessageType } from "../dataflow";
import { IDisposable } from "../types";
import { IStreamSource, IStreamSourceActivation } from "./streaming.datasource.interfaces";
import { IStreamSourceProducer } from "./streaming.producer.interfaces";

type ActivationBatch = IPipelineMessageType<IStreamSourceActivation>;

/**
 * Activation state per (viewId, sourceId). Drives cancellation when a deactivate
 * races against an in-flight load.
 *  - loading   : the payload fetch is pending; no ready emission yet
 *  - active    : status === "ready", content is available, scene holds the object
 *  - cancelled : a deactivate / unload arrived while still loading; when the load
 *                finally resolves we discard the payload and emit no transition
 */
type ActivationStatus = "loading" | "active" | "cancelled";

interface IActivationState {
    status: ActivationStatus;
}

/**
 * Base class for 1:1 (static) datasource producers.
 *
 * For each activation:
 *  1. ADD is emitted immediately with status = "downloading"
 *  2. _load(source) runs asynchronously
 *  3. on success  : status = "ready", content = payload, UPDATE emitted
 *     on failure  : status = "failed" (or "failed-permanently" if subclass decides), UPDATE emitted
 *     on cancel   : REMOVE emitted, payload discarded
 *  4. on deactivate : status = "deactivated", REMOVE emitted (content stays cached for re-activation)
 *  5. on unload     : cache.delete, content dropped
 *
 * Cancellation is safe: a deactivate arriving while the source is still loading
 * flips the internal state to "cancelled"; the pending load's result is discarded
 * for THIS view but the shared load keeps running for other views (see `_pending`).
 *
 * Spawner producers (1:N) should extend IStreamSourceProducer directly and NOT rely
 * on this base class: their lifecycle does not match the 1:1 model.
 */
export abstract class AbstractStreamSourceProducer<T = unknown> extends SourceBlock<IStreamSource<T>> implements IStreamSourceProducer<T>, IDisposable {
    public abstract readonly contentType: string;

    protected readonly _cache: IMemoryCache<string, T>;
    private readonly _pending: Map<string, Promise<T>> = new Map();
    private readonly _states: Map<string, Map<string, IActivationState>> = new Map();

    public constructor(cache?: IMemoryCache<string, T>) {
        super();
        this._cache = cache ?? new MemoryCache<string, T>();
    }

    public handles(source: IStreamSource): boolean {
        return source.contentType === this.contentType;
    }

    public added = (batch: ActivationBatch, _es: EventState): void => {
        void this._handle(batch);
    };
    public removed = (batch: ActivationBatch, _es: EventState): void => {
        void this._handle(batch);
    };
    public updated = (batch: ActivationBatch, _es: EventState): void => {
        void this._handle(batch);
    };

    /** Fetch and build the payload. Shared across views (deduped via `_pending`). */
    protected abstract _load(source: IStreamSource<T>): Promise<T>;
    /** Optional hook for subclasses (e.g. ref-counting). Default no-op. */
    protected _onActivated(_source: IStreamSource<T>, _viewId: string): void {}
    /** Optional hook for subclasses (e.g. ref-counting). Default no-op. */
    protected _onDeactivated(_source: IStreamSource<T>, _viewId: string): void {}
    /** Optional hook on unload. Default no-op. */
    protected _onUnloaded(_source: IStreamSource<T>, _payload: T): void {}

    public override dispose(): void {
        this._states.clear();
        this._pending.clear();
        this._cache.dispose();
        super.dispose();
    }

    private async _handle(batch: ActivationBatch): Promise<void> {
        for (const a of batch) {
            if (!this.handles(a.source)) continue;
            switch (a.operation) {
                case "load":
                    await this._ensureLoaded(a.source as IStreamSource<T>);
                    break;
                case "activate":
                    await this._doActivate(a);
                    break;
                case "update":
                    this._doUpdate(a);
                    break;
                case "deactivate":
                    this._doDeactivate(a);
                    break;
                case "unload":
                    this._doUnload(a);
                    break;
            }
        }
    }

    private async _doActivate(a: IStreamSourceActivation): Promise<void> {
        const src = a.source as IStreamSource<T>;
        const existing = this._getState(a.viewId, src.id);
        if (existing && (existing.status === "loading" || existing.status === "active")) {
            return;
        }

        const state: IActivationState = { status: "loading" };
        this._setState(a.viewId, src.id, state);

        // Emit ADD immediately with downloading status so the scene can render placeholders.
        src.status = "downloading";
        this.notifyAdded([src]);

        let payload: T;
        try {
            payload = await this._ensureLoaded(src);
        } catch (err) {
            if (this._getState(a.viewId, src.id) === state) {
                src.status = "failed";
                this.notifyUpdated([src]);
                this._deleteState(a.viewId, src.id);
            }
            throw err;
        }

        if (state.status === "cancelled") {
            // deactivate raced with the load; ADD was already emitted so we must emit REMOVE
            this._deleteState(a.viewId, src.id);
            src.status = "deactivated";
            this.notifyRemoved([src]);
            return;
        }

        state.status = "active";
        src.status = "ready";
        src.content = payload;
        this._onActivated(src, a.viewId);
        this.notifyUpdated([src]);
    }

    private _doUpdate(a: IStreamSourceActivation): void {
        const src = a.source as IStreamSource<T>;
        const state = this._getState(a.viewId, src.id);
        if (state?.status === "active") {
            this.notifyUpdated([src]);
        }
    }

    private _doDeactivate(a: IStreamSourceActivation): void {
        const src = a.source as IStreamSource<T>;
        const state = this._getState(a.viewId, src.id);
        if (!state) return;
        if (state.status === "loading") {
            state.status = "cancelled";
            return;
        }
        if (state.status === "active") {
            src.status = "deactivated";
            this._onDeactivated(src, a.viewId);
            this._deleteState(a.viewId, src.id);
            this.notifyRemoved([src]);
        }
    }

    private _doUnload(a: IStreamSourceActivation): void {
        const src = a.source as IStreamSource<T>;
        const state = this._getState(a.viewId, src.id);
        if (state?.status === "loading") {
            state.status = "cancelled";
        } else if (state?.status === "active") {
            src.status = "deactivated";
            this._onDeactivated(src, a.viewId);
            this._deleteState(a.viewId, src.id);
            this.notifyRemoved([src]);
        }
        const payload = this._cache.get(src.id);
        if (payload !== undefined) {
            this._onUnloaded(src, payload);
            this._cache.delete(src.id);
            src.content = null;
        }
    }

    private async _ensureLoaded(source: IStreamSource<T>): Promise<T> {
        const cached = this._cache.get(source.id);
        if (cached !== undefined) return cached;
        let pending = this._pending.get(source.id);
        if (!pending) {
            pending = (async () => {
                try {
                    const p = await this._load(source);
                    this._cache.set(source.id, p);
                    return p;
                } finally {
                    this._pending.delete(source.id);
                }
            })();
            this._pending.set(source.id, pending);
        }
        return pending;
    }

    private _getState(viewId: string, sourceId: string): IActivationState | undefined {
        return this._states.get(viewId)?.get(sourceId);
    }

    private _setState(viewId: string, sourceId: string, state: IActivationState): void {
        let m = this._states.get(viewId);
        if (!m) {
            m = new Map();
            this._states.set(viewId, m);
        }
        m.set(sourceId, state);
    }

    private _deleteState(viewId: string, sourceId: string): void {
        const m = this._states.get(viewId);
        if (!m) return;
        m.delete(sourceId);
        if (m.size === 0) this._states.delete(viewId);
    }
}
