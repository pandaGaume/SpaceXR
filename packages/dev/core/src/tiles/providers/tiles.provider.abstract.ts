import { ITile, ITileAddress, ITileBuilder, ITileMetrics, ITileProvider } from "../tiles.interfaces";
import { EventState, Observable } from "../../events/events.observable";
import { IEnvelope } from "../../geography/geography.interfaces";
import { IBounds2 } from "../../geometry/geometry.interfaces";
import { TileCollection } from "../tiles.collection";
import { TileBuilder } from "../tiles.builder";
import { ILinkOptions, IPipelineMessageType, ITargetBlock, ITilePipelineLink, TilePipelineLink } from "../pipeline";
import { Nullable } from "../../types";

export abstract class AbstractTileProvider<T> implements ITileProvider<T> {
    _updateObservable?: Observable<IPipelineMessageType<ITile<T>>>;
    _addedObservable?: Observable<IPipelineMessageType<ITile<T>>>;
    _removedObservable?: Observable<IPipelineMessageType<ITile<T>>>;

    _enabledObservable?: Observable<ITileProvider<T>>;

    _factory: ITileBuilder<T>;
    _activTiles: TileCollection<T>;
    _enabled: boolean;

    // internal
    _callback: (t: ITile<T>) => void;
    // internal pipeline links
    _links: Array<ITilePipelineLink<ITile<T>>> = [];

    public constructor(factory?: ITileBuilder<T>, enabled = true) {
        this._factory = factory ?? this._buildFactory();
        this._enabled = enabled;
        this._activTiles = new TileCollection<T>();
        this._callback = this._onContentFetched.bind(this);
    }

    public get geoBounds(): IEnvelope | undefined {
        return this._activTiles?.geoBounds;
    }

    public get bounds(): IBounds2 | undefined {
        return this._activTiles?.bounds;
    }

    public get enabledObservable(): Observable<ITileProvider<T>> {
        this._enabledObservable = this._enabledObservable || new Observable<ITileProvider<T>>();
        return this._enabledObservable!;
    }

    public get enabled(): boolean {
        return this._enabled;
    }

    public set enabled(v: boolean) {
        if (this._enabled !== v) {
            this._enabled = v;
            if (this._enabledObservable && this._enabledObservable.hasObservers()) {
                this._enabledObservable.notifyObservers(this, -1, this, this);
            }
        }
    }

    public get metrics(): ITileMetrics {
        return this.factory.metrics;
    }

    public get namespace(): string {
        return this.factory.namespace;
    }

    public get factory(): ITileBuilder<T> {
        return this._factory;
    }

    public dispose() {
        this._activTiles?.clear();
    }

    public get activTiles(): Array<Nullable<ITile<T>>> {
        return Array.from(this._activTiles);
    }

    public getTile(a: ITileAddress): Nullable<ITile<T>> | undefined {
        return this._activTiles.get(a);
    }

    public hasTile(a: ITileAddress): boolean {
        return this._activTiles.has(a);
    }

    /// begin ISourceBlock
    public get updatedObservable(): Observable<IPipelineMessageType<ITile<T>>> {
        this._updateObservable = this._updateObservable || new Observable<IPipelineMessageType<ITile<T>>>();
        return this._updateObservable!;
    }

    public get addedObservable(): Observable<IPipelineMessageType<ITile<T>>> {
        this._addedObservable = this._addedObservable || new Observable<IPipelineMessageType<ITile<T>>>();
        return this._addedObservable!;
    }

    public get removedObservable(): Observable<IPipelineMessageType<ITile<T>>> {
        this._removedObservable = this._removedObservable || new Observable<IPipelineMessageType<ITile<T>>>();
        return this._removedObservable!;
    }

    public linkTo(target: ITargetBlock<ITile<T>>, options?: ILinkOptions<ITile<T>>): void {
        // a view may be linked to several targets, so we need to keep track of them.
        if (this._links.findIndex((l) => l.target === target) === -1) {
            // avoid linking twice to the same target
            const link = new TilePipelineLink(this, target, options);
            this._links.push(link);
        }
    }

    public unlinkFrom(target: ITargetBlock<ITile<T>>): ITilePipelineLink<ITile<T>> | undefined {
        const i = this._links.findIndex((l) => l.target === target);
        if (i !== -1) {
            const l = this._links.splice(i)[0];
            l.dispose();
            return l;
        }
        return undefined;
    }

    /// end ISourceBlock

    /// begin ITargetBlock
    public added(eventData: IPipelineMessageType<ITileAddress>, eventState: EventState): void {
        const data = Array.isArray(eventData) ? eventData : [eventData];
        this._onTileAddressesAdded(data, eventState);
    }
    public removed(eventData: IPipelineMessageType<ITileAddress>, eventState: EventState): void {
        const data = Array.isArray(eventData) ? eventData : [eventData];
        this._onTileAddressesRemoved(data, eventState);
    }
    public updated(eventData: IPipelineMessageType<ITileAddress>, eventState: EventState): void {
        // nothing to do here, updating address is not suppose to happen
    }
    /// end ITargetBlock

    protected _onTileAddressesAdded(address: Array<ITileAddress>, eventState: EventState): Array<ITile<T>> {
        const toActivate = address.length === 0 ? [...(this._activTiles ?? [])].map((t) => t.address) : address;
        const tiles = new Array<ITile<T>>();
        for (const a of toActivate ?? []) {
            const t = this._activTiles?.get(a);
            if (t) {
                tiles.push(t);
                continue;
            }
            const factory = this._factory.withAddress(a);
            try {
                let tile = factory.build();
                if (tile) {
                    // fetch content, possibiliy generate alterative content
                    // if underlying async operation are performed, then the callback will be messaged when the content
                    // is available.
                    tile = this._fetchContent(tile, this._callback);
                    // add to collection
                    this._activTiles?.add(tile);
                    // push to result
                    tiles.push(tile);
                }
            } catch (e) {
                console.log(e);
            }
        }
        if (tiles.length && this._addedObservable) {
            this._addedObservable.notifyObservers(tiles, -1, this, this);
        }
        return tiles;
    }

    protected _onTileAddressesRemoved(address: Array<ITileAddress>, eventState: EventState): Array<ITile<T>> {
        if (this._activTiles && this._activTiles.count) {
            const tiles = new Array<ITile<T>>();
            for (const a of address ?? []) {
                const t = this._activTiles?.get(a);
                if (t) {
                    tiles.push(t);
                    this._activTiles?.remove(a)!;
                }
            }
            if (tiles.length && this._removedObservable) {
                this._removedObservable.notifyObservers(tiles, -1, this, this);
            }
            return tiles;
        }
        return [];
    }

    protected _onContentFetched(tile: ITile<T>): void {
        if (this.updatedObservable?.hasObservers()) {
            this.updatedObservable.notifyObservers([tile], -1, this, this);
        }
    }

    protected _buildFactory(): ITileBuilder<T> {
        return new TileBuilder<T>();
    }

    public abstract _fetchContent(tile: ITile<T>, callback: (t: ITile<T>) => void): ITile<T>;
}
