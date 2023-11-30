import { Nullable } from "../types";
import { EventState, Observable, Observer } from "../events/events.observable";
import { ITile, ITileAddress, ITileBuilder } from "./tiles.interfaces";
import { ITileContentProvider, ITileProvider, ITileView } from "./tiles.interfaces.pipeline";

export class TilesProvider<T> implements ITileProvider<T> {
    _tileUpdateObservable?: Observable<Array<ITile<T>>>;
    _tileAddedObservable?: Observable<Array<ITile<T>>>;
    _tileRemovedObservable?: Observable<Array<ITile<T>>>;
    _id?: string | undefined;
    _contentProviders?: Map<string, ITileContentProvider<T>>;
    _view: ITileView;
    _addedObserver?: Nullable<Observer<Array<ITileAddress>>>;
    _removedObserver?: Nullable<Observer<Array<ITileAddress>>>;

    public constructor(id: string, view: ITileView) {
        this._id = id;
        this._view = view;
        this._addedObserver = this._view.addressAddedObservable.add(this.onTileAdded.bind(this));
        this._removedObserver = this._view.addressRemovedObservable.add(this.onTileRemoved.bind(this));
    }

    public dispose() {
        this._addedObserver?.dispose();
        this._removedObserver?.dispose();
    }

    public get id(): string | undefined {
        return this._id;
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

    getTile(address: ITileAddress): Nullable<ITile<T>[]> {
        throw new Error("Method not implemented.");
    }

    addContentProvider<P extends T>(contentProvider: ITileContentProvider<P>, builder: ITileBuilder<P>): void {
        if (contentProvider === undefined) throw new Error("Content provider must be defined");
        if (contentProvider.id === undefined) throw new Error("Content provider must have an id");
        if (this._contentProviders === undefined) {
            this._contentProviders = new Map<string, ITileContentProvider<T>>();
        }
        const tmp: unknown = contentProvider;
        this._contentProviders.set(contentProvider.id, <ITileContentProvider<T>>tmp);
    }

    removeContentProvider<P extends T>(name: string): void {
        if (this._contentProviders === undefined) {
            return;
        }
        if (name === undefined || name === "") throw new Error("name can't be empty");
        this._contentProviders.delete(name);
    }

    getProviderByName<P extends T>(name: string): ITileContentProvider<P> | undefined {
        if (this._contentProviders) {
            if (name === undefined || name === "") throw new Error("name can't be empty");
            const tmp: unknown = this._contentProviders.get(name);
            if (tmp) {
                return <ITileContentProvider<P>>tmp;
            }
        }
        return undefined;
    }

    protected onTileAdded(eventData: ITileAddress[], eventState: EventState): void {}
    protected onTileRemoved(eventData: ITileAddress[], eventState: EventState): void {}

    protected _onTileUpdateObserverAdded(observer: Observer<Array<ITile<T>>>): void {}
    protected _onTileAddedObserverAdded(observer: Observer<Array<ITile<T>>>): void {}
    protected _onTileRemovedObserverAdded(observer: Observer<Array<ITile<T>>>): void {}
}
