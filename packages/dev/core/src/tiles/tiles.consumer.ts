import { EventState, Observer } from "../events/events.observable";
import { ITileConsumer, ITileProvider } from "./tiles.interfaces.pipeline";
import { ITile } from "./tiles.interfaces";
import { Nullable } from "../types";

export class TileConsumerBase<T> implements ITileConsumer<T> {
    _id?: string;

    _provider: ITileProvider<T>;
    _addedObserver: Nullable<Observer<ITile<T>[]>>;
    _removedObserver: Nullable<Observer<ITile<T>[]>>;
    _updateObserver: Nullable<Observer<ITile<T>[]>>;

    public constructor(id: string, provider: ITileProvider<T>) {
        this._id = id;
        this._provider = provider;
        this._addedObserver = this._provider.tileAddedObservable.add(this.onTileAdded.bind(this));
        this._removedObserver = this._provider.tileRemovedObservable.add(this.onTileRemoved.bind(this));
        this._updateObserver = this._provider.tileUpdatedObservable.add(this.onTileUpdated.bind(this));
    }

    public dispose(): void {
        this._addedObserver?.dispose();
        this._removedObserver?.dispose();
        this._updateObserver?.dispose();
    }

    public get id(): string | undefined {
        return this._id;
    }

    protected onTileAdded(eventData: ITile<T>[], eventState: EventState): void {}
    protected onTileRemoved(eventData: ITile<T>[], eventState: EventState): void {}
    protected onTileUpdated(eventData: ITile<T>[], eventState: EventState): void {}
}
