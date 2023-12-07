import { Nullable } from "../../types";
import { EventState, Observable, Observer } from "../../events/events.observable";
import { ITile, ITileAddress, ITileMetrics, IsTileSection } from "../tiles.interfaces";
import { ITileProducer, ITileProvider, ITileView } from "./tiles.pipeline.interfaces";
import { TilePipelineComponent } from "./tiles.pipeline";

interface TileProducerItem<T> {
    provider: ITileProvider<T>;
    updateObserver?: Nullable<Observer<ITile<T>>>;
    enabledObserver?: Nullable<Observer<ITileProvider<T>>>;
}

export class TilesProducer<T> extends TilePipelineComponent implements ITileProducer<T> {
    _tileUpdateObservable?: Observable<ITile<T>>;
    _tileAddedObservable?: Observable<Array<ITile<T>>>;
    _tileRemovedObservable?: Observable<Array<ITile<T>>>;

    _items?: Map<string, TileProducerItem<T>>;
    _view?: ITileView;
    _metrics: ITileMetrics;
    _addedObserver?: Nullable<Observer<Array<ITileAddress>>>;
    _removedObserver?: Nullable<Observer<Array<ITileAddress>>>;

    public constructor(id: string, metrics: ITileMetrics, view?: ITileView) {
        super(id);
        this._metrics = metrics;
        this.view = view;
    }

    public get metrics() {
        return this._metrics;
    }

    public get view(): ITileView | undefined {
        return this._view;
    }

    public set view(value: ITileView | undefined) {
        if (this._view !== value) {
            this._view = value;
            this._addedObserver?.dispose();
            this._removedObserver?.dispose();
            this._addedObserver = this._view?.addressAddedObservable.add(this._onTileAddressesAdded.bind(this));
            this._removedObserver = this._view?.addressRemovedObservable.add(this._onTileAddressesRemoved.bind(this));
        }
    }

    public dispose() {
        this._addedObserver?.dispose();
        this._removedObserver?.dispose();
    }

    public get tileUpdatedObservable(): Observable<ITile<T>> {
        this._tileUpdateObservable = this._tileUpdateObservable || new Observable<ITile<T>>();
        return this._tileUpdateObservable!;
    }

    public get tileAddedObservable(): Observable<Array<ITile<T>>> {
        this._tileAddedObservable = this._tileAddedObservable || new Observable<Array<ITile<T>>>();
        return this._tileAddedObservable!;
    }
    public get tileRemovedObservable(): Observable<Array<ITile<T>>> {
        this._tileRemovedObservable = this._tileRemovedObservable || new Observable<Array<ITile<T>>>();
        return this._tileRemovedObservable!;
    }

    public getTile(address: ITileAddress, ...userArgs: Array<unknown>): Nullable<ITile<T>[]> {
        throw new Error("Method not implemented.");
    }

    public *providers(predicate?: (p: ITileProvider<T>) => boolean): IterableIterator<ITileProvider<T>> {
        if (this._items) {
            for (const p of this._items.values()) {
                if (predicate === undefined || predicate(p.provider)) {
                    yield p.provider;
                }
            }
        }
    }

    public addProvider(provider: ITileProvider<T>): void {
        if (provider?.name === undefined || provider.name === "") throw new Error("system name can't be empty");
        this._items = this._items ?? new Map<string, TileProducerItem<T>>();
        if (this._items.has(provider.name)) {
            // remove previous provider with same name
            const old = this._items.get(provider.name);
            if (old?.provider === provider) {
                return; // nothing to do, already in.
            }
            this.removeProvider(provider.name);
        }
        const item: TileProducerItem<T> = {
            provider: provider,
            updateObserver: provider.tileUpdatedObservable.add(this._onTileUpdated.bind(this)),
            enabledObserver: provider.enableObservable.add(this._onProviderEnablePropertyChanged.bind(this)),
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
        if (name === undefined || name === "") throw new Error("name can't be empty");
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
            if (name === undefined || name === "") throw new Error("name can't be empty");
            return this._items.get(name)?.provider;
        }
        return undefined;
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
                this._tileAddedObservable.notifyObservers(tiles, -1, ts.provider, this, eventState.userInfo);
            }
        }
    }

    protected _onTileAddressAdded(item: TileProducerItem<T>, address: ITileAddress, buffer: ITile<T>[]): void {
        let tmp = item.provider.addressProcessor?.process(address, this.metrics) ?? [];
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
                this._tileRemovedObservable.notifyObservers(tiles, -1, ts.provider, this, eventState.userInfo);
            }
        }
    }

    protected _onTileAddressRemoved(item: TileProducerItem<T>, address: ITileAddress, buffer: ITile<T>[]): void {
        let tmp = item.provider.addressProcessor?.process(address, this.metrics) ?? [];
        if (IsTileSection(tmp)) {
            tmp = [tmp.address];
        }
        buffer.push(...item.provider.deactivateTile(...tmp));
    }

    protected _onTileUpdated(eventData: ITile<T>, eventState: EventState): void {
        const provider = eventState.target as ITileProvider<T>;
        if (provider?.enabled) {
            if (this.tileUpdatedObservable && this.tileUpdatedObservable.hasObservers()) {
                this.tileUpdatedObservable.notifyObservers(eventData, -1, provider, this, eventState.userInfo);
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
