import { EventState, Observer } from "../events/events.observable";
import { ITileConsumer, ITileProvider } from "./tiles.interfaces.pipeline";
import { ITile } from "./tiles.interfaces";
import { Nullable } from "../types";
export declare class TileConsumerBase<T> implements ITileConsumer<T> {
    _id?: string;
    _provider: ITileProvider<T>;
    _addedObserver: Nullable<Observer<ITile<T>[]>>;
    _removedObserver: Nullable<Observer<ITile<T>[]>>;
    _updateObserver: Nullable<Observer<ITile<T>[]>>;
    constructor(id: string, provider: ITileProvider<T>);
    dispose(): void;
    get id(): string | undefined;
    protected onTileAdded(eventData: ITile<T>[], eventState: EventState): void;
    protected onTileRemoved(eventData: ITile<T>[], eventState: EventState): void;
    protected onTileUpdated(eventData: ITile<T>[], eventState: EventState): void;
}
