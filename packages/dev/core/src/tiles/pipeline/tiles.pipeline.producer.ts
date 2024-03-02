import { Nullable } from "../../types";
import { EventState, Observable, Observer } from "../../events/events.observable";
import { ITile, ITileAddress, ITileMetrics, ITileProvider, ITileSection, IsTileSection } from "../tiles.interfaces";
import { ILinkOptions, IPipelineMessageType, ITargetBlock, ITilePipelineLink, ITileProducer } from "./tiles.pipeline.interfaces";
import { TilePipelineLink } from "./tiles.pipeline.link";

/// <summary>
/// Internal interface to keep track of the provider subscription
/// </summary>
interface ITileProducerItem<T> {
    provider: ITileProvider<T>;
    updateObserver?: Nullable<Observer<ITile<T>>>;
    enabledObserver?: Nullable<Observer<ITileProvider<T>>>;
}

export class TileProducer<T> implements ITileProducer<T> {
    private static AssertValidName(name: string): void {
        if (name === undefined || name === "") throw new Error("system name can't be empty");
    }

    _updateObservable?: Observable<IPipelineMessageType<ITile<T>>>;
    _addedObservable?: Observable<IPipelineMessageType<ITile<T>>>;
    _removedObservable?: Observable<IPipelineMessageType<ITile<T>>>;

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

    public get name(): string {
        return this._id;
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

    public linkTo(target: ITargetBlock<ITile<T>>, options?: ILinkOptions): void {
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
        TileProducer.AssertValidName(provider?.namespace);
        this._items = this._items ?? new Map<string, ITileProducerItem<T>>();
        if (this._items.has(provider.namespace)) {
            // remove previous provider with same name
            const old = this._items.get(provider.namespace);
            if (old?.provider === provider) {
                return; // nothing to do, already in.
            }
            this.removeProvider(provider.namespace);
        }
        const item: ITileProducerItem<T> = {
            provider: provider,
            updateObserver: provider.updatedObservable.add(this._onTileUpdated.bind(this)),
            enabledObserver: provider.enabledObservable.add(this._onProviderEnablePropertyChanged.bind(this)),
        };
        this._items.set(provider.namespace, item);
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
            tmp.updateObserver?.disconnect();
            tmp.enabledObserver?.disconnect();
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

        // dispose the provider observers
        for (const p of this._items?.values() ?? []) {
            p.updateObserver?.disconnect();
            p.enabledObserver?.disconnect();
        }
        this._items?.clear();
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
            if (this._addedObservable && this._addedObservable.hasObservers()) {
                this._addedObservable.notifyObservers(tiles, -1, ts.provider, this, eventState?.userInfo);
            }
        }
    }

    protected _onTileAddressAdded(item: ITileProducerItem<T>, address: ITileAddress | ITileSection, buffer: ITile<T>[], metrics?: ITileMetrics): void {
        if (IsTileSection(address)) {
            address = address.address;
        }
        buffer.push(...item.provider.activateTile(address));
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
            if (this._removedObservable && this._removedObservable.hasObservers()) {
                this._removedObservable.notifyObservers(tiles, -1, ts.provider, this, eventState?.userInfo);
            }
        }
    }

    protected _onTileAddressRemoved(item: ITileProducerItem<T>, address: ITileAddress | ITileSection, buffer: ITile<T>[], metrics?: ITileMetrics): void {
        if (IsTileSection(address)) {
            address = address.address;
        }
        buffer.push(...item.provider.deactivateTile(address));
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
