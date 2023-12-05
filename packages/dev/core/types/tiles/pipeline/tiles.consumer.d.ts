import { EventState, Observable, Observer } from "../../events/events.observable";
import { ITileConsumer, ITileProvider } from "./tiles.pipeline.interfaces";
import { ITile } from "../tiles.interfaces";
import { Nullable } from "../../types";
import { PropertyChangedEventArgs } from "../../events/events.args";
export declare class TileConsumerBase<T> implements ITileConsumer<T> {
    _id?: string;
    _provider?: ITileProvider<T>;
    _addedObserver?: Nullable<Observer<ITile<T>[]>>;
    _removedObserver?: Nullable<Observer<ITile<T>[]>>;
    _updateObserver?: Nullable<Observer<ITile<T>[]>>;
    _providerChangedObservable?: Observable<PropertyChangedEventArgs<ITileConsumer<T>, ITileProvider<T>>>;
    constructor(id: string, provider?: ITileProvider<T>);
    get providerChangedObservable(): Observable<PropertyChangedEventArgs<ITileConsumer<T>, ITileProvider<T>>>;
    get provider(): ITileProvider<T> | undefined;
    set provider(provider: ITileProvider<T> | undefined);
    dispose(): void;
    protected _disposeObservers(): void;
    protected _registerObservers(): void;
    get id(): string | undefined;
    protected _onTileAdded(eventData: ITile<T>[], eventState: EventState): void;
    protected _onTileRemoved(eventData: ITile<T>[], eventState: EventState): void;
    protected _onTileUpdated(eventData: ITile<T>[], eventState: EventState): void;
    protected _onProviderChanged(oldProvider: ITileProvider<T> | undefined, newProvider: ITileProvider<T> | undefined): void;
}
