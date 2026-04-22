import { EventState, Observer } from "../../events";
import { IPipelineMessageType, ITransformBlock } from "../../dataflow";
import { SourceBlock } from "../../tiles/pipeline/tiles.pipeline.sourceblock";
import { ITile, ITile2DAddress, ITileLoader } from "../../tiles/tiles.interfaces";
import { IDisposable } from "../../types";
import { IStreamSource, StreamSourceStatus } from "../streaming.datasource.interfaces";
import { TileStreamSource } from "./tile.stream.source";

type StreamBatch = IPipelineMessageType<IStreamSource<ITile2DAddress>>;
type TileBatch<T> = IPipelineMessageType<ITile<T>>;

/**
 * Bridges a TilePyramidStreamSource (or any source emitting IStreamSource<ITile2DAddress>)
 * to an existing ITileLoader. The adapter :
 *
 *  - unwraps the address from each incoming stream source and forwards it to
 *    the loader (so the loader resolves content in its usual way),
 *  - subscribes to the loader's added / updated / removed observables and
 *    writes back on the matching stream sources : flips `status` to
 *    `"downloading"` → `"ready"` and attaches the fetched `ITile<T>` on
 *    `TileStreamSource.tile`,
 *  - re-emits each status transition through its own `updated` / `removed`
 *    observables, so downstream scene consumers keep a single uniform stream.
 *
 * Wiring :
 *     pyramid.linkTo(adapter);
 *     adapter.linkTo(sceneTarget);
 *
 * Multi-view caveat : when the same quadkey is emitted twice (one per view)
 * the adapter keeps the last reference per quadkey. Loader-level dedup is
 * already enforced by TileCollection, so this is safe.
 */
export class TileLoaderAdapter<T = unknown>
    extends SourceBlock<IStreamSource<ITile2DAddress>>
    implements ITransformBlock<IStreamSource<ITile2DAddress>, IStreamSource<ITile2DAddress>>, IDisposable
{
    private readonly _loader: ITileLoader<T>;
    private readonly _addressForwarder: SourceBlock<ITile2DAddress>;
    private readonly _entries: Map<string, IStreamSource<ITile2DAddress>> = new Map();
    private readonly _loaderObservers: Array<Observer<any>> = [];

    public constructor(loader: ITileLoader<T>) {
        super();
        this._loader = loader;

        // Proxy SourceBlock used to forward addresses through the existing
        // pipeline machinery (so we honour any ILinkOptions the caller may set).
        this._addressForwarder = new SourceBlock<ITile2DAddress>();
        this._addressForwarder.linkTo(loader);

        const onAdded = loader.addedObservable.add((batch) => this._onLoaderAdded(batch));
        const onUpdated = loader.updatedObservable.add((batch) => this._onLoaderUpdated(batch));
        const onRemoved = loader.removedObservable.add((batch) => this._onLoaderRemoved(batch));
        if (onAdded) this._loaderObservers.push(onAdded);
        if (onUpdated) this._loaderObservers.push(onUpdated);
        if (onRemoved) this._loaderObservers.push(onRemoved);
    }

    public get loader(): ITileLoader<T> {
        return this._loader;
    }

    // ───────── ITargetBlock ─────────

    public added = (batch: StreamBatch, _es: EventState): void => {
        const addresses: ITile2DAddress[] = [];
        const updatedStatus: IStreamSource<ITile2DAddress>[] = [];
        for (const src of batch) {
            const addr = src.content;
            if (!addr) continue;
            this._entries.set(addr.quadkey, src);
            if (src.status === StreamSourceStatus.pending) {
                src.status = StreamSourceStatus.loading;
                updatedStatus.push(src);
            }
            addresses.push(addr);
        }
        if (addresses.length > 0) {
            this._addressForwarder.notifyAdded(addresses);
        }
        if (updatedStatus.length > 0) {
            this.notifyUpdated(updatedStatus);
        }
    };

    public removed = (batch: StreamBatch, _es: EventState): void => {
        const addresses: ITile2DAddress[] = [];
        const out: IStreamSource<ITile2DAddress>[] = [];
        for (const src of batch) {
            const addr = src.content;
            if (!addr) continue;
            this._entries.delete(addr.quadkey);
            // Leave `status` untouched : the removed event is the authoritative
            // signal. Drop the attached tile ref so consumers do not hold stale data.
            if (src instanceof TileStreamSource) src.tile = null;
            addresses.push(addr);
            out.push(src);
        }
        if (addresses.length > 0) {
            this._addressForwarder.notifyRemoved(addresses);
        }
        if (out.length > 0) {
            this.notifyRemoved(out);
        }
    };

    public updated = (batch: StreamBatch, _es: EventState): void => {
        // Pass-through : address-level update is rare (pyramid addresses are
        // immutable) but we forward in case a caller injects synthetic updates.
        if (batch.length > 0) this.notifyUpdated(batch);
    };

    public override dispose(): void {
        for (const o of this._loaderObservers) o.disconnect();
        this._loaderObservers.length = 0;
        this._addressForwarder.unlinkFrom(this._loader);
        this._addressForwarder.dispose();
        this._entries.clear();
        super.dispose();
    }

    // ───────── loader callbacks ─────────

    private _onLoaderAdded(batch: TileBatch<T>): void {
        // The loader's addedObservable fires when a tile object is created
        // (content may still be null, fetch is async). Keep status downloading
        // but attach the tile ref right away so downstream sees a live object.
        this._applyLoaderBatch(batch, /*ready=*/ false);
    }

    private _onLoaderUpdated(batch: TileBatch<T>): void {
        // Fires when the async content arrives. Flip status to ready.
        this._applyLoaderBatch(batch, /*ready=*/ true);
    }

    private _onLoaderRemoved(batch: TileBatch<T>): void {
        const out: IStreamSource<ITile2DAddress>[] = [];
        for (const tile of batch) {
            const entry = this._entries.get(tile.address.quadkey);
            if (!entry) continue;
            this._entries.delete(tile.address.quadkey);
            // Leave `status` untouched ; the removed event conveys the drop.
            if (entry instanceof TileStreamSource) entry.tile = null;
            out.push(entry);
        }
        if (out.length > 0) this.notifyRemoved(out);
    }

    private _applyLoaderBatch(batch: TileBatch<T>, ready: boolean): void {
        const out: IStreamSource<ITile2DAddress>[] = [];
        for (const tile of batch) {
            const entry = this._entries.get(tile.address.quadkey);
            if (!entry) continue;
            if (entry instanceof TileStreamSource) entry.tile = tile;
            if (ready && tile.content !== null) {
                entry.status = StreamSourceStatus.ready;
            } else if (entry.status === StreamSourceStatus.pending) {
                entry.status = StreamSourceStatus.loading;
            }
            out.push(entry);
        }
        if (out.length > 0) this.notifyUpdated(out);
    }
}
