import { EventState, Observable, PropertyChangedEventArgs } from "../../events";
import { IPipelineMessageType, ITileConsumer } from "./tiles.pipeline.interfaces";
import { ITile, ITileCollection } from "../tiles.interfaces";
import { ValidableBase } from "../../validable";
import { Nullable } from "../../types";
export declare class TileConsumerBase<T> extends ValidableBase implements ITileConsumer<T> {
    _propertyChangedObservable?: Observable<PropertyChangedEventArgs<unknown, unknown>> | undefined;
    _name: string;
    constructor(id: string);
    get propertyChangedObservable(): Observable<PropertyChangedEventArgs<unknown, unknown>>;
    get name(): string;
    set name(name: string);
    added(eventData: IPipelineMessageType<ITile<T>>, eventState: EventState): void;
    removed(eventData: IPipelineMessageType<ITile<T>>, eventState: EventState): void;
    updated(eventData: IPipelineMessageType<ITile<T>>, eventState: EventState): void;
    dispose(): void;
    getActiveTiles(): Nullable<ITileCollection<T>>;
    protected _onTileAdded(eventData: Array<ITile<T>>, eventState: EventState): void;
    protected _onTileRemoved(eventData: Array<ITile<T>>, eventState: EventState): void;
    protected _onTileUpdated(eventData: Array<ITile<T>>, eventState: EventState): void;
}
