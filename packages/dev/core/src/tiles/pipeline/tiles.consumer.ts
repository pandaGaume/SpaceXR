import { EventState, Observable, Observer } from "../../events/events.observable";
import { ITileConsumer, ITileProvider } from "./tiles.interfaces.pipeline";
import { ITile } from "../tiles.interfaces";
import { Nullable } from "../../types";
import { PropertyChangedEventArgs } from "../../events/events.args";

export class TileConsumerBase<T> implements ITileConsumer<T> {
    _id?: string;

    _provider?: ITileProvider<T>;
    _addedObserver?: Nullable<Observer<ITile<T>[]>>;
    _removedObserver?: Nullable<Observer<ITile<T>[]>>;
    _updateObserver?: Nullable<Observer<ITile<T>[]>>;

    _providerChangedObservable?: Observable<PropertyChangedEventArgs<ITileConsumer<T>, ITileProvider<T>>>;

    public constructor(id: string, provider?: ITileProvider<T>) {
        this._id = id;
        this.provider = provider;
    }

    public get providerChangedObservable(): Observable<PropertyChangedEventArgs<ITileConsumer<T>, ITileProvider<T>>> {
        if (!this._providerChangedObservable) {
            this._providerChangedObservable = new Observable<PropertyChangedEventArgs<ITileConsumer<T>, ITileProvider<T>>>();
        }
        return this._providerChangedObservable;
    }

    public get provider(): ITileProvider<T> | undefined {
        return this._provider;
    }

    public set provider(provider: ITileProvider<T> | undefined) {
        if (this._provider !== provider) {
            const old = this._provider;
            if (this._provider) {
                this._disposeObservers();
            }
            this._provider = provider;
            if (this._provider) {
                this._registerObservers();
            }
            this._onProviderChanged(old, this._provider);
            if (this._providerChangedObservable && this) {
                this._providerChangedObservable.notifyObservers(new PropertyChangedEventArgs(this, old, this._provider));
            }
        }
    }

    public dispose(): void {
        this._disposeObservers();
    }

    protected _disposeObservers(): void {
        this._addedObserver?.dispose();
        this._removedObserver?.dispose();
        this._updateObserver?.dispose();
        this._addedObserver = null;
        this._removedObserver = null;
        this._updateObserver = null;
    }

    protected _registerObservers(): void {
        this._addedObserver = this._provider?.tileAddedObservable.add(this._onTileAdded.bind(this));
        this._removedObserver = this._provider?.tileRemovedObservable.add(this._onTileRemoved.bind(this));
        this._updateObserver = this._provider?.tileUpdatedObservable.add(this._onTileUpdated.bind(this));
    }

    public get id(): string | undefined {
        return this._id;
    }

    protected _onTileAdded(eventData: ITile<T>[], eventState: EventState): void {}
    protected _onTileRemoved(eventData: ITile<T>[], eventState: EventState): void {}
    protected _onTileUpdated(eventData: ITile<T>[], eventState: EventState): void {}
    protected _onProviderChanged(oldProvider: ITileProvider<T> | undefined, newProvider: ITileProvider<T> | undefined): void {}
}
