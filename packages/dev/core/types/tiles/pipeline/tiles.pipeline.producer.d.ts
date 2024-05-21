import { Nullable } from "../../types";
import { EventState, Observable, Observer } from "../../events/events.observable";
import { ITile, ITileAddress, ITileMetrics, ITileProvider } from "../tiles.interfaces";
import { ILinkOptions, IPipelineMessageType, ITargetBlock, ITilePipelineLink, ITileProducer } from "./tiles.pipeline.interfaces";
interface ITileProducerItem<T> {
    provider: ITileProvider<T>;
    updateObserver?: Nullable<Observer<ITile<T>>>;
    enabledObserver?: Nullable<Observer<ITileProvider<T>>>;
}
export declare class TileProducer<T> implements ITileProducer<T> {
    private static AssertValidName;
    _updateObservable?: Observable<IPipelineMessageType<ITile<T>>>;
    _addedObservable?: Observable<IPipelineMessageType<ITile<T>>>;
    _removedObservable?: Observable<IPipelineMessageType<ITile<T>>>;
    _items?: Map<string, ITileProducerItem<T>>;
    _id: string;
    _links: Array<ITilePipelineLink<ITile<T>>>;
    constructor(id: string, ...provider: Array<ITileProvider<T>>);
    get name(): string;
    get updatedObservable(): Observable<IPipelineMessageType<ITile<T>>>;
    get addedObservable(): Observable<IPipelineMessageType<ITile<T>>>;
    get removedObservable(): Observable<IPipelineMessageType<ITile<T>>>;
    linkTo(target: ITargetBlock<ITile<T>>, options?: ILinkOptions): void;
    unlinkFrom(target: ITargetBlock<ITile<T>>): ITilePipelineLink<ITile<T>> | undefined;
    added(eventData: IPipelineMessageType<ITileAddress>, eventState: EventState): void;
    removed(eventData: IPipelineMessageType<ITileAddress>, eventState: EventState): void;
    updated(eventData: IPipelineMessageType<ITileAddress>, eventState: EventState): void;
    getTile(address: ITileAddress, ...userArgs: Array<unknown>): Nullable<ITile<T>[]>;
    getProviders(predicate?: (p: ITileProvider<T>) => boolean): IterableIterator<ITileProvider<T>>;
    addProvider(provider: ITileProvider<T>): void;
    removeProvider(name: string): void;
    getProviderByName(name: string): ITileProvider<T> | undefined;
    dispose(): void;
    protected _onTileAddressesAdded(eventData: ITileAddress[], eventState: EventState): void;
    protected _onTileAddressAdded(item: ITileProducerItem<T>, address: ITileAddress, buffer: ITile<T>[], metrics?: ITileMetrics): void;
    protected _onTileAddressesRemoved(eventData: ITileAddress[], eventState: EventState): void;
    protected _onTileAddressRemoved(item: ITileProducerItem<T>, address: ITileAddress, buffer: ITile<T>[], metrics?: ITileMetrics): void;
    protected _onTileUpdated(eventData: ITile<T>, eventState: EventState): void;
    protected _onProviderEnablePropertyChanged(eventData: ITileProvider<T>, eventState: EventState): void;
}
export {};
