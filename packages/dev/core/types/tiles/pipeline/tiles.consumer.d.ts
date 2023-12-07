import { EventState, Observer } from "../../events/events.observable";
import { ITileConsumer, ITileProducer } from "./tiles.pipeline.interfaces";
import { IValidable, Nullable } from "../../types";
import { ITile } from "../tiles.interfaces";
interface ITileConsumerItem<T> {
    _producer: ITileProducer<T>;
    _addedObserver?: Nullable<Observer<Array<ITile<T>>>>;
    _removedObserver?: Nullable<Observer<Array<ITile<T>>>>;
    _updateObserver?: Nullable<Observer<ITile<T>>>;
}
export declare class TileConsumerBase<T> implements ITileConsumer<T>, IValidable<TileConsumerBase<T>> {
    _id?: string;
    _valid: boolean;
    protected _items?: Map<string, ITileConsumerItem<T>>;
    constructor(id: string);
    get id(): string | undefined;
    get isValid(): boolean;
    invalidate(): TileConsumerBase<T>;
    validate(): TileConsumerBase<T>;
    revalidate(): TileConsumerBase<T>;
    addProducer(producer: ITileProducer<T>): void;
    removeProducer(name: string): void;
    getProducerByName(name: string): ITileProducer<T> | undefined;
    dispose(): void;
    producers(): IterableIterator<ITileProducer<T>>;
    protected _onTileAdded(eventData: Array<ITile<T>>, eventState: EventState): void;
    protected _onTileRemoved(eventData: Array<ITile<T>>, eventState: EventState): void;
    protected _onTileUpdated(eventData: ITile<T>, eventState: EventState): void;
    protected _doValidateInternal(): void;
    protected _beforeValidate(): void;
    protected _doValidate(): void;
    protected _afterValidate(): void;
}
export {};
