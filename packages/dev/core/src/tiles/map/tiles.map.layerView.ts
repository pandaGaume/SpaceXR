import { EventState } from "../../events";
import { Nullable } from "../../types";
import { ValidableBase } from "../../validable";
import { ILinkOptions, IPipelineMessageType, ITargetBlock, ITileView, TileView } from "../pipeline";
import { TargetProxy } from "../pipeline/tiles.pipeline.proxy";
import { ITileAddress, ITile } from "../tiles.interfaces";
import { ITileMapLayer, ITileMapLayerView } from "./tiles.map.interfaces";

export class TileMapLayerView<T, L extends ITileMapLayer<T>> extends ValidableBase implements ITileMapLayerView<T, L>, ILinkOptions<ITile<T>> {
    private _layer: L;
    private _source: ITileView;
    private _ownSource: boolean;
    private _tiles: Map<string, Nullable<ITile<T>>>;
    private _tilesTarget: ITargetBlock<ITile<T>>;

    public constructor(layer: L, source?: ITileView) {
        super();
        this._layer = layer;
        this._tiles = new Map<string, Nullable<ITile<T>>>();
        this._ownSource = source === undefined || source === null;
        this._source = this._ownSource ? this._buildSource(layer.name) : source!;

        this._source?.linkTo(this);
        // add a link with a filter, based on addresses
        const options: ILinkOptions<ITile<T>> = { accept: this.accept.bind(this) };
        this._tilesTarget = new TargetProxy<ITile<T>>({
            added: this._addedTile.bind(this),
            removed: this._removedTile.bind(this),
            updated: this._updatedTile.bind(this),
        });
        this._layer.provider.linkTo(this._tilesTarget, options);
    }

    public get layer(): L {
        return this._layer;
    }

    public get view(): ITileView {
        return this._source;
    }

    public accept(tile: ITile<T>): boolean {
        const has = this._tiles.has(tile.address.quadkey);
        return has;
    }

    public added(eventData: IPipelineMessageType<ITileAddress>, eventState: EventState): void {
        this._addedAddress(eventData, eventState);
    }

    public removed(eventData: IPipelineMessageType<ITileAddress>, eventState: EventState): void {
        this._removedAddress(eventData, eventState);
    }

    public updated(eventData: IPipelineMessageType<ITileAddress>, eventState: EventState): void {
        this._updatedAddress(eventData, eventState);
    }

    public dispose(): void {
        this._source?.unlinkFrom(this);
        if (this._ownSource) {
            this._source.dispose();
        }
        this.layer.provider.unlinkFrom(this._tilesTarget);
        this._tiles.clear();
    }

    protected _buildSource(id: string): ITileView {
        return new TileView(id);
    }

    protected _addedAddress(eventData: IPipelineMessageType<ITileAddress>, eventState: EventState): void {
        const added = [];
        for (const a of eventData) {
            const k = a.quadkey;
            const t = this._tiles.get(k);
            if (!t) {
                this._tiles.set(k, null);
                added.push(a);
            }
        }
        if (added.length) {
            this._layer.provider.added(added, eventState);
        }
    }

    protected _removedAddress(eventData: IPipelineMessageType<ITileAddress>, eventState: EventState): void {
        const removed = [];
        for (const a of eventData) {
            const k = a.quadkey;
            const t = this._tiles.get(k);
            if (t) {
                this._tiles.delete(k);
                removed.push(a);
                this._layer.provider.removed(eventData, eventState);
            }
        }
        if (removed.length) {
            this._layer.provider.removed(removed, eventState);
        }
    }

    protected _updatedAddress(eventData: IPipelineMessageType<ITileAddress>, eventState: EventState): void {
        // non sense to update address..
    }

    protected _addedTile(eventData: IPipelineMessageType<ITile<T>>, eventState: EventState): void {
        for (const t of eventData) {
            this._tiles.set(t.address.quadkey, t);
        }
        this.invalidate();
    }

    protected _removedTile(eventData: IPipelineMessageType<ITile<T>>, eventState: EventState): void {
        // very unlucky happening. This mean that the underlying provider has been cleared or disposed, or even
        // underlying data are not longer exist.
        for (const t of eventData) {
            this._tiles.delete(t.address.quadkey);
        }
        this.invalidate();
    }

    protected _updatedTile(eventData: IPipelineMessageType<ITile<T>>, eventState: EventState): void {
        for (const t of eventData) {
            this._tiles.set(t.address.quadkey, t);
        }
        this.invalidate();
    }
}
