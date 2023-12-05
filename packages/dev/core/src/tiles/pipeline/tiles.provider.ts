import { IDisposable, Nullable } from "../../types";
import { EventState, Observable, Observer } from "../../events/events.observable";
import { ITile, ITileAddress, ITileMetrics, IsTileSection } from "../tiles.interfaces";
import { ITileProvider, ITileSystem, ITileView } from "./tiles.pipeline.interfaces";
import { ITileSystemOptions, TileSystem } from "./tiles.system";
import { TilePipelineComponent } from "./tiles.pipeline";

class TileContentProviderItem<T> extends TileSystem<T> implements IDisposable {
    private _tiles: Map<string, ITile<T>>;

    constructor(name: string, options: ITileSystemOptions<T>) {
        super(name, options);
        this._tiles = new Map<string, ITile<T>>();
    }

    public dispose() {
        this._tiles.clear();
    }

    public get activTiles(): Map<string, ITile<T>> {
        return this._tiles;
    }
}

export class TilesProvider<T> extends TilePipelineComponent implements ITileProvider<T> {
    _tileUpdateObservable?: Observable<Array<ITile<T>>>;
    _tileAddedObservable?: Observable<Array<ITile<T>>>;
    _tileRemovedObservable?: Observable<Array<ITile<T>>>;

    _items?: Map<string, TileContentProviderItem<T>>;
    _view: ITileView<T>;
    _metrics: ITileMetrics;
    _addedObserver?: Nullable<Observer<Array<ITileAddress>>>;
    _removedObserver?: Nullable<Observer<Array<ITileAddress>>>;

    public constructor(id: string, view: ITileView<T>, metrics: ITileMetrics) {
        super(id);
        this._view = view;
        this._metrics = metrics;

        this._addedObserver = this._view.addressAddedObservable.add(this._onTileAddressesAdded.bind(this));
        this._removedObserver = this._view.addressRemovedObservable.add(this._onTileAddressesRemoved.bind(this));
    }

    public get metrics() {
        return this._metrics;
    }

    public dispose() {
        this._addedObserver?.dispose();
        this._removedObserver?.dispose();
    }

    public get tileUpdatedObservable(): Observable<Array<ITile<T>>> {
        this._tileUpdateObservable = this._tileUpdateObservable || new Observable<Array<ITile<T>>>(this._onTileUpdateObserverAdded.bind(this));
        return this._tileUpdateObservable!;
    }

    public get tileAddedObservable(): Observable<Array<ITile<T>>> {
        this._tileAddedObservable = this._tileAddedObservable || new Observable<Array<ITile<T>>>(this._onTileAddedObserverAdded.bind(this));
        return this._tileAddedObservable!;
    }
    public get tileRemovedObservable(): Observable<Array<ITile<T>>> {
        this._tileRemovedObservable = this._tileRemovedObservable || new Observable<Array<ITile<T>>>(this._onTileRemovedObserverAdded.bind(this));
        return this._tileRemovedObservable!;
    }

    public getTile(address: ITileAddress, ...userArgs: Array<unknown>): Nullable<ITile<T>[]> {
        throw new Error("Method not implemented.");
    }

    public addContentProvider<P extends T>(system: ITileSystem<P>): void {
        if (system?.name === undefined || system.name === "") throw new Error("system name can't be empty");
        this._items = this._items ?? new Map<string, TileContentProviderItem<T>>();
        const tmp = new TileContentProviderItem<P>(system.name, {
            metrics: this.metrics,
            addressProcessor: system.addressProcessor,
            provider: system.provider,
            factory: system.factory,
        });
        this._items.set(system.name, tmp);
    }

    public removeContentProvider(name: string): void {
        if (this._items === undefined) {
            return;
        }
        if (name === undefined || name === "") throw new Error("name can't be empty");
        const tmp = this._items.get(name) as TileContentProviderItem<T>;
        if (tmp && this._items.delete(name)) {
            tmp.dispose();
        }
    }

    public getContentProviderByName<P extends T>(name: string): ITileSystem<P> | undefined {
        if (this._items) {
            if (name === undefined || name === "") throw new Error("name can't be empty");
            const tmp = this._items.get(name);
            return tmp as unknown as ITileSystem<P>;
        }
        return undefined;
    }

    protected _onTileAddressesAdded(eventData: ITileAddress[], eventState: EventState): void {
        // this is the place where we should add the tile to the system
        const tiles = new Array<ITile<T>>();
        for (const ts of this._items?.values() ?? []) {
            for (const address of eventData) {
                this._onTileAddressAdded(ts, address, tiles);
            }
        }
        if (this._tileAddedObservable && this._tileAddedObservable.hasObservers()) {
            this._tileAddedObservable.notifyObservers(tiles);
        }
    }

    protected _onTileAddressAdded(system: TileContentProviderItem<T>, address: ITileAddress, buffer: ITile<T>[]): void {
        let a = system.addressProcessor?.process(address, this.metrics) ?? [];
        if (IsTileSection(a)) {
            a = [a.address];
        }
        const factory = system.factory.withNamespace(system.provider.name);
        for (const address of a) {
            if (system.activTiles.has(address.quadkey)) {
                buffer.push(system.activTiles.get(address.quadkey)!);
            }
            const tile = factory.withAddress(address).build();
            if (tile) {
                system.activTiles.set(address.quadkey, tile);
                buffer.push(tile);
                system.provider.fetchContentAsync(tile.address).then((content) => {
                    if (content) {
                        tile.content = content;
                        if (this.tileUpdatedObservable && this.tileUpdatedObservable.hasObservers()) {
                            this.tileUpdatedObservable.notifyObservers([tile]);
                        }
                    }
                });
            }
        }
    }

    protected _onTileAddressesRemoved(eventData: ITileAddress[], eventState: EventState): void {
        // this is the place where we should remove the tile from the system
        const tiles = new Array<ITile<T>>();
        for (const ts of this._items?.values() ?? []) {
            for (const address of eventData) {
                this._onTileAddressRemoved(ts, address, tiles);
            }
        }
        if (this._tileRemovedObservable && this._tileRemovedObservable.hasObservers()) {
            this._tileRemovedObservable.notifyObservers(tiles);
        }
    }

    protected _onTileAddressRemoved(system: TileContentProviderItem<T>, address: ITileAddress, buffer: ITile<T>[]): void {
        let a = system.addressProcessor?.process(address, this.metrics) ?? [];
        if (IsTileSection(a)) {
            a = [a.address];
        }
        for (const address of a) {
            if (system.activTiles.has(address.quadkey)) {
                buffer.push(system.activTiles.get(address.quadkey)!);
                system.activTiles.delete(address.quadkey);
            }
        }
    }

    protected _onTileUpdateObserverAdded(observer: Observer<Array<ITile<T>>>): void {
        /*nothing to do here*/
    }
    protected _onTileAddedObserverAdded(observer: Observer<Array<ITile<T>>>): void {
        /*nothing to do here*/
    }
    protected _onTileRemovedObserverAdded(observer: Observer<Array<ITile<T>>>): void {
        /*nothing to do here*/
    }
}
