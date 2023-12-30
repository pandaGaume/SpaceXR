import { Nullable } from "../../types";
import { EventState, Observable, Observer } from "../../events/events.observable";
import { ITile, ITileAddress, ITileMetrics, ITileProvider, IsTileSection } from "../tiles.interfaces";
import { ILinkOptions, IPipelineMessageType, ITargetBlock, ITilePipelineLink, ITileProducer } from "./tiles.pipeline.interfaces";
import { TilePipelineLink } from "./tiles.pipeline.link";

interface ITileProducerItem<T> {
    provider: ITileProvider<T>;
    updateObserver?: Nullable<Observer<ITile<T>>>;
    enabledObserver?: Nullable<Observer<ITileProvider<T>>>;
}

export class TileProducer<T> implements ITileProducer<T> {
    private static AssertValidName(name: string): void {
        if (name === undefined || name === "") throw new Error("system name can't be empty");
    }

    _tileUpdateObservable?: Observable<IPipelineMessageType<ITile<T>>>;
    _tileAddedObservable?: Observable<IPipelineMessageType<ITile<T>>>;
    _tileRemovedObservable?: Observable<IPipelineMessageType<ITile<T>>>;

    _items?: Map<string, ITileProducerItem<T>>;
    _id: string;

    // internal pipeline links
    _links: Array<ITilePipelineLink<ITile<T>>> = [];

    public constructor(id: string, ...provider: Array<ITileProvider<T>>) {
        this._id = id;
        for (const p of provider) {
            this.addProvider(p);
        }
    }

    public get id(): string {
        return this._id;
    }

    /// begin ISourceBlock
    public get updatedObservable(): Observable<IPipelineMessageType<ITile<T>>> {
        this._tileUpdateObservable = this._tileUpdateObservable || new Observable<IPipelineMessageType<ITile<T>>>();
        return this._tileUpdateObservable!;
    }

    public get addedObservable(): Observable<IPipelineMessageType<ITile<T>>> {
        this._tileAddedObservable = this._tileAddedObservable || new Observable<IPipelineMessageType<ITile<T>>>();
        return this._tileAddedObservable!;
    }

    public get removedObservable(): Observable<IPipelineMessageType<ITile<T>>> {
        this._tileRemovedObservable = this._tileRemovedObservable || new Observable<IPipelineMessageType<ITile<T>>>();
        return this._tileRemovedObservable!;
    }

    public linkTo(target: ITargetBlock<ITile<T>>, options?: ILinkOptions): void {
        // a view may be linked to several targets, so we need to keep track of them.
        if (this._links.findIndex((l) => l.target === target) === -1) {
            const link = new TilePipelineLink(this, target, options);
            this._links.push(link);
        }
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

    public getTile(address: ITileAddress, ...userArgs: Array<unknown>): Nullable<ITile<T>[]> {
        throw new Error("Method not implemented.");
    }

    public *getProviders(predicate?: (p: ITileProvider<T>) => boolean): IterableIterator<ITileProvider<T>> {
        if (this._items) {
            for (const p of this._items.values()) {
                if (predicate === undefined || predicate(p.provider)) {
                    yield p.provider;
                }
            }
        }
    }

    public addProvider(provider: ITileProvider<T>): void {
        TileProducer.AssertValidName(provider?.name);
        this._items = this._items ?? new Map<string, ITileProducerItem<T>>();
        if (this._items.has(provider.name)) {
            // remove previous provider with same name
            const old = this._items.get(provider.name);
            if (old?.provider === provider) {
                return; // nothing to do, already in.
            }
            this.removeProvider(provider.name);
        }
        const item: ITileProducerItem<T> = {
            provider: provider,
            updateObserver: provider.updatedObservable.add(this._onTileUpdated.bind(this)),
            enabledObserver: provider.enabledObservable.add(this._onProviderEnablePropertyChanged.bind(this)),
        };
        this._items.set(provider.name, item);
        if (provider.enabled) {
            provider.activateTile(); // add all tiles if already in.
        }
    }

    public removeProvider(name: string): void {
        if (this._items === undefined) {
            return;
        }
        TileProducer.AssertValidName(name);
        const tmp = this._items.get(name);
        if (tmp) {
            tmp.provider.deactivateTile(); // remove all tiles
            this._items.delete(name);
            tmp.updateObserver?.dispose();
            tmp.enabledObserver?.dispose();
        }
    }

    public getProviderByName(name: string): ITileProvider<T> | undefined {
        if (this._items) {
            TileProducer.AssertValidName(name);
            return this._items.get(name)?.provider;
        }
        return undefined;
    }

    public dispose() {
        // dispose the links
        for (const l of this._links) {
            l.dispose();
        }
        this._links = [];
    }

    protected _onTileAddressesAdded(eventData: ITileAddress[], eventState: EventState): void {
        // this is the place where we should add the tile to the system
        for (const ts of this._items?.values() ?? []) {
            if (ts.provider.enabled === false) {
                continue;
            }
            const tiles = new Array<ITile<T>>();
            for (const address of eventData) {
                this._onTileAddressAdded(ts, address, tiles);
            }
            if (this._tileAddedObservable && this._tileAddedObservable.hasObservers()) {
                this._tileAddedObservable.notifyObservers(tiles, -1, ts.provider, this, eventState?.userInfo);
            }
        }
    }

    protected _onTileAddressAdded(item: ITileProducerItem<T>, address: ITileAddress, buffer: ITile<T>[], metrics?: ITileMetrics): void {
        let tmp = item.provider.addressProcessor?.process(address, metrics ?? item.provider.metrics) ?? [];
        if (IsTileSection(tmp)) {
            tmp = [tmp.address];
        }
        buffer.push(...item.provider.activateTile(...tmp));
    }

    protected _onTileAddressesRemoved(eventData: ITileAddress[], eventState: EventState): void {
        // this is the place where we should remove the tile from the system
        for (const ts of this._items?.values() ?? []) {
            if (ts.provider.enabled === false) {
                continue;
            }
            const tiles = new Array<ITile<T>>();
            for (const address of eventData) {
                this._onTileAddressRemoved(ts, address, tiles);
            }
            if (this._tileRemovedObservable && this._tileRemovedObservable.hasObservers()) {
                this._tileRemovedObservable.notifyObservers(tiles, -1, ts.provider, this, eventState?.userInfo);
            }
        }
    }

    protected _onTileAddressRemoved(item: ITileProducerItem<T>, address: ITileAddress, buffer: ITile<T>[], metrics?: ITileMetrics): void {
        let tmp = item.provider.addressProcessor?.process(address, metrics ?? item.provider.metrics) ?? [];
        if (IsTileSection(tmp)) {
            tmp = [tmp.address];
        }
        buffer.push(...item.provider.deactivateTile(...tmp));
    }

    protected _onTileUpdated(eventData: ITile<T>, eventState: EventState): void {
        const provider = eventState.target as ITileProvider<T>;
        if (provider?.enabled) {
            if (this.updatedObservable && this.updatedObservable.hasObservers()) {
                this.updatedObservable.notifyObservers([eventData], -1, provider, this, eventState?.userInfo);
            }
        }
    }

    protected _onProviderEnablePropertyChanged(eventData: ITileProvider<T>, eventState: EventState): void {
        if (eventData.enabled) {
            eventData.activateTile(); // add all tiles if already in.
        } else {
            eventData.deactivateTile(); // remove all tiles
        }
    }
}
