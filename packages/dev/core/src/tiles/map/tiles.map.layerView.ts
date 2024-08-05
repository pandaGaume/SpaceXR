import { EventState } from "../../events";
import { Nullable } from "../../types";
import { ValidableBase } from "../../validable";
import { ILinkOptions, IPipelineMessageType, ITargetBlock, ITileView, TileView } from "../pipeline";
import { TargetProxy } from "../pipeline/tiles.pipeline.proxy";
import { ITileAddress, ITile, ITileMetrics } from "../tiles.interfaces";
import { ITileMapLayer, ITileMapLayerView } from "./tiles.map.interfaces";

export class TileMapLayerView<T, L extends ITileMapLayer<T>> extends ValidableBase implements ITileMapLayerView<T, L>, ILinkOptions<ITile<T>> {
    private _layer: L;
    private _view: ITileView;
    private _ownView: boolean;
    private _tiles: Map<string, Nullable<ITile<T>>>;
    private _tilesTargetProxy: ITargetBlock<ITile<T>>;

    public constructor(layer: L, source?: ITileView) {
        super();
        this._layer = layer;
        this._tiles = new Map<string, Nullable<ITile<T>>>();
        this._ownView = source === undefined || source === null;
        this._view = this._ownView ? this._buildSource(layer.name) : source!;

        this._view?.linkTo(this);
        // add a link with a filter, based on addresses
        // the use of the proxy is due to the inability of Typescript to support
        // methods polymorphism.
        this._tilesTargetProxy = new TargetProxy<ITile<T>>(
            {
                updated: this._updatedTile,
                added: this._addedTile,
            },
            this
        );
        this._layer.provider.linkTo(this._tilesTargetProxy, { accept: this.accept.bind(this) });
    }

    public get layer(): L {
        return this._layer;
    }

    public get view(): ITileView {
        return this._view;
    }

    public get metrics(): ITileMetrics {
        return this._layer.metrics;
    }

    public get activTiles(): Array<Nullable<ITile<T>>> {
        return Array.from(this._tiles.values());
    }

    public accept(tile: ITile<T>): boolean {
        return this._tiles.has(tile.address.quadkey);
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
        super.dispose();
        this._view?.unlinkFrom(this);
        if (this._ownView) {
            this._view.dispose();
        }
        this.layer.provider.unlinkFrom(this._tilesTargetProxy);
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
        if (added.length && this._layer.provider.added) {
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
            }
        }
        if (removed.length && this._layer.provider.removed) {
            this._layer.provider.removed(removed, eventState);
        }
    }

    protected _updatedAddress(eventData: IPipelineMessageType<ITileAddress>, eventState: EventState): void {
        // non sense to update address..
    }

    protected _addedTile(eventData: IPipelineMessageType<ITile<T>>, eventState: EventState): void {
        // the provider as coded for now is DO NOT emmit Added event
        for (const t of eventData) {
            this._tiles.set(t.address.quadkey, t);
        }
        this.invalidate();
    }

    protected _removedTile(eventData: IPipelineMessageType<ITile<T>>, eventState: EventState): void {
        // the provider as coded for now is DO NOT emmit Removed event
        for (const t of eventData) {
            this._tiles.delete(t.address.quadkey);
        }
        this.invalidate();
    }

    protected _updatedTile(eventData: IPipelineMessageType<ITile<T>>, eventState: EventState): void {
        this.invalidate();
    }
}
