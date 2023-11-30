import { Nullable } from "../types";
import { EventState, Observable, Observer } from "../events/events.observable";
import { ITile, ITileAddress, ITileBuilder } from "./tiles.interfaces";
import { ITileContentProvider, ITileProvider, ITileView } from "./tiles.interfaces.pipeline";
export declare class TilesProvider<T> implements ITileProvider<T> {
    _tileUpdateObservable?: Observable<Array<ITile<T>>>;
    _tileAddedObservable?: Observable<Array<ITile<T>>>;
    _tileRemovedObservable?: Observable<Array<ITile<T>>>;
    _id?: string | undefined;
    _contentProviders?: Map<string, ITileContentProvider<T>>;
    _view: ITileView;
    _addedObserver?: Nullable<Observer<Array<ITileAddress>>>;
    _removedObserver?: Nullable<Observer<Array<ITileAddress>>>;
    constructor(id: string, view: ITileView);
    dispose(): void;
    get id(): string | undefined;
    get tileUpdatedObservable(): Observable<Array<ITile<T>>>;
    get tileAddedObservable(): Observable<Array<ITile<T>>>;
    get tileRemovedObservable(): Observable<Array<ITile<T>>>;
    getTile(address: ITileAddress): Nullable<ITile<T>[]>;
    addContentProvider<P extends T>(contentProvider: ITileContentProvider<P>, builder: ITileBuilder<P>): void;
    removeContentProvider<P extends T>(name: string): void;
    getProviderByName<P extends T>(name: string): ITileContentProvider<P> | undefined;
    protected onTileAdded(eventData: ITileAddress[], eventState: EventState): void;
    protected onTileRemoved(eventData: ITileAddress[], eventState: EventState): void;
    protected _onTileUpdateObserverAdded(observer: Observer<Array<ITile<T>>>): void;
    protected _onTileAddedObserverAdded(observer: Observer<Array<ITile<T>>>): void;
    protected _onTileRemovedObserverAdded(observer: Observer<Array<ITile<T>>>): void;
}
