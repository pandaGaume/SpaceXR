import { EventState, Observer } from "../../../events";
import { IStreamSource } from "../../../streaming/streaming.datasource.interfaces";
import { IDisposable, Nullable } from "../../../types";
import { IPipelineMessageType, ITargetBlock, SourceBlock } from "../../pipeline";
import { ITile3d } from "../interfaces";
import { ITile3dContentLoader, TileContentStatus } from "./tile3d.stream.engine";
import { Tile3dStreamSource } from "./tile3d.stream.source";

/**
 * Glue between a Tile3dStreamSource and a content loader:
 *
 *  - Downstream, it unwraps the engine's IStreamSource<ITile3d> emissions to
 *    plain ITile3d batches, so existing sinks (Tile3dScene) keep their
 *    contract.
 *  - It drives the loader: entering tiles with unfetched renderable content
 *    are enqueued, leaving tiles are cancelled while still pending.
 *  - It closes the async loop: when the loader reports a tile settled, the
 *    binding invalidates the source (re-traversal picks up the new state,
 *    e.g. opens a REPLACE gate) and forwards the update to sinks.
 *
 * Wiring: `new Tile3dStreamBinding(source, loader).linkTo(scene)`.
 */
export class Tile3dStreamBinding extends SourceBlock<ITile3d> implements ITargetBlock<IStreamSource<ITile3d>>, IDisposable {
    private readonly _source: Tile3dStreamSource;
    private readonly _loader: ITile3dContentLoader;
    private _loaderObserver: Nullable<Observer<IPipelineMessageType<ITile3d>>>;

    public constructor(source: Tile3dStreamSource, loader: ITile3dContentLoader) {
        super();
        this._source = source;
        this._loader = loader;
        source.linkTo(this as unknown as ITargetBlock<IStreamSource<unknown>>);
        this._loaderObserver = loader.updatedObservable.add((tiles, state) => this._onLoaderUpdated(tiles, state));
    }

    public get source(): Tile3dStreamSource {
        return this._source;
    }

    public added(eventData: IPipelineMessageType<IStreamSource<ITile3d>>, _eventState: EventState): void {
        const tiles: Array<ITile3d> = [];
        for (const s of eventData) {
            const tile = s?.content;
            if (!tile) continue;
            if (tile.hasContent && tile.contentStatus === TileContentStatus.idle) {
                this._loader.load(tile);
            }
            tiles.push(tile);
        }
        if (tiles.length) this.notifyAdded(tiles, -1, this, this);
    }

    public removed(eventData: IPipelineMessageType<IStreamSource<ITile3d>>, _eventState: EventState): void {
        const tiles: Array<ITile3d> = [];
        for (const s of eventData) {
            const tile = s?.content;
            if (!tile) continue;
            // cancel() only acts on tiles still pending in the queue.
            this._loader.cancel(tile);
            tiles.push(tile);
        }
        if (tiles.length) this.notifyRemoved(tiles, -1, this, this);
    }

    public updated(eventData: IPipelineMessageType<IStreamSource<ITile3d>>, _eventState: EventState): void {
        const tiles: Array<ITile3d> = [];
        for (const s of eventData) {
            const tile = s?.content;
            if (tile) tiles.push(tile);
        }
        if (tiles.length) this.notifyUpdated(tiles, -1, this, this);
    }

    private _onLoaderUpdated(tiles: IPipelineMessageType<ITile3d>, _state: EventState): void {
        // A failed fetch holds back the REPLACE swap (the parent keeps covering
        // the footprint), so retry a bounded number of times before accepting
        // the coarse fallback permanently.
        for (const tile of tiles) {
            if (tile?.contentStatus !== TileContentStatus.error) continue;
            const attempts = (tile.contentAttempts ?? 0) + 1;
            tile.contentAttempts = attempts;
            if (attempts < Tile3dStreamSource.MaxLoadAttempts) {
                tile.contentStatus = TileContentStatus.idle; // re-enqueued by the next traversal
            }
        }
        // Re-traverse so load completions open REPLACE gates / trigger swaps,
        // then let sinks react to the tiles' new status.
        this._source.invalidate();
        this.notifyUpdated(tiles, -1, this, this);
    }

    public override dispose(): void {
        if (this._loaderObserver) {
            this._loaderObserver.disconnect();
            this._loaderObserver = null;
        }
        // Stop receiving the source's emissions: otherwise a disposed binding
        // keeps driving the loader.
        this._source.unlinkFrom(this as unknown as ITargetBlock<IStreamSource<unknown>>);
        super.dispose();
    }
}
