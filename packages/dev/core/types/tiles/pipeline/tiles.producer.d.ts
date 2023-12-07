import { Nullable } from "../../types";
import { EventState, Observable, Observer } from "../../events/events.observable";
import { ITile, ITileAddress, ITileMetrics } from "../tiles.interfaces";
import { ITileProducer, ITileProvider, ITileView } from "./tiles.pipeline.interfaces";
import { TilePipelineComponent } from "./tiles.pipeline";
interface TileProducerItem<T> {
    provider: ITileProvider<T>;
    updateObserver?: Nullable<Observer<ITile<T>>>;
    enabledObserver?: Nullable<Observer<ITileProvider<T>>>;
}
export declare class TilesProducer<T> extends TilePipelineComponent implements ITileProducer<T> {
    _tileUpdateObservable?: Observable<ITile<T>>;
    _tileAddedObservable?: Observable<Array<ITile<T>>>;
    _tileRemovedObservable?: Observable<Array<ITile<T>>>;
    _items?: Map<string, TileProducerItem<T>>;
    _view?: ITileView;
    _metrics: ITileMetrics;
    _addedObserver?: Nullable<Observer<Array<ITileAddress>>>;
    _removedObserver?: Nullable<Observer<Array<ITileAddress>>>;
    constructor(id: string, metrics: ITileMetrics, view?: ITileView);
    get metrics(): ITileMetrics;
    get view(): ITileView | undefined;
    set view(value: ITileView | undefined);
    dispose(): void;
    get tileUpdatedObservable(): Observable<ITile<T>>;
    get tileAddedObservable(): Observable<Array<ITile<T>>>;
    get tileRemovedObservable(): Observable<Array<ITile<T>>>;
    getTile(address: ITileAddress, ...userArgs: Array<unknown>): Nullable<ITile<T>[]>;
    providers(predicate?: (p: ITileProvider<T>) => boolean): IterableIterator<ITileProvider<T>>;
    addProvider(provider: ITileProvider<T>): void;
    removeProvider(name: string): void;
    getProviderByName(name: string): ITileProvider<T> | undefined;
    protected _onTileAddressesAdded(eventData: ITileAddress[], eventState: EventState): void;
    protected _onTileAddressAdded(item: TileProducerItem<T>, address: ITileAddress, buffer: ITile<T>[]): void;
    protected _onTileAddressesRemoved(eventData: ITileAddress[], eventState: EventState): void;
    protected _onTileAddressRemoved(item: TileProducerItem<T>, address: ITileAddress, buffer: ITile<T>[]): void;
    protected _onTileUpdated(eventData: ITile<T>, eventState: EventState): void;
    protected _onProviderEnablePropertyChanged(eventData: ITileProvider<T>, eventState: EventState): void;
}
export {};
