import { IDisposable, Nullable } from "../../types";
import { EventState, Observable, Observer } from "../../events/events.observable";
import { ITile, ITileAddress, ITileMetrics } from "../tiles.interfaces";
import { ITileProvider, ITileSystem, ITileView } from "./tiles.pipeline.interfaces";
import { ITileSystemOptions, TileSystem } from "./tiles.system";
import { TilePipelineComponent } from "./tiles.pipeline";
declare class TileContentProviderItem<T> extends TileSystem<T> implements IDisposable {
    private _tiles;
    constructor(name: string, options: ITileSystemOptions<T>);
    dispose(): void;
    get activTiles(): Map<string, ITile<T>>;
}
export declare class TilesProvider<T> extends TilePipelineComponent implements ITileProvider<T> {
    _tileUpdateObservable?: Observable<Array<ITile<T>>>;
    _tileAddedObservable?: Observable<Array<ITile<T>>>;
    _tileRemovedObservable?: Observable<Array<ITile<T>>>;
    _items?: Map<string, TileContentProviderItem<T>>;
    _view: ITileView<T>;
    _metrics: ITileMetrics;
    _addedObserver?: Nullable<Observer<Array<ITileAddress>>>;
    _removedObserver?: Nullable<Observer<Array<ITileAddress>>>;
    constructor(id: string, view: ITileView<T>, metrics: ITileMetrics);
    get metrics(): ITileMetrics;
    dispose(): void;
    get tileUpdatedObservable(): Observable<Array<ITile<T>>>;
    get tileAddedObservable(): Observable<Array<ITile<T>>>;
    get tileRemovedObservable(): Observable<Array<ITile<T>>>;
    getTile(address: ITileAddress, ...userArgs: Array<unknown>): Nullable<ITile<T>[]>;
    addContentProvider<P extends T>(system: ITileSystem<P>): void;
    removeContentProvider(name: string): void;
    getContentProviderByName<P extends T>(name: string): ITileSystem<P> | undefined;
    protected _onTileAddressesAdded(eventData: ITileAddress[], eventState: EventState): void;
    protected _onTileAddressAdded(system: TileContentProviderItem<T>, address: ITileAddress, buffer: ITile<T>[]): void;
    protected _onTileAddressesRemoved(eventData: ITileAddress[], eventState: EventState): void;
    protected _onTileAddressRemoved(system: TileContentProviderItem<T>, address: ITileAddress, buffer: ITile<T>[]): void;
    protected _onTileUpdateObserverAdded(observer: Observer<Array<ITile<T>>>): void;
    protected _onTileAddedObserverAdded(observer: Observer<Array<ITile<T>>>): void;
    protected _onTileRemovedObserverAdded(observer: Observer<Array<ITile<T>>>): void;
}
export {};
