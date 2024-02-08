import { EventState, Observable, PropertyChangedEventArgs } from "../../events";
import { IDisposable, Nullable } from "../../types";
import { ITile, ITileAddress, ITileCollection, ITileMetrics, ITileProvider } from "../tiles.interfaces";
import { ITileNavigationState } from "../navigation/tiles.navigation.interfaces";
import { ITileDisplay } from "../map";
export type IPipelineMessageType<T> = Array<T>;
export interface ITargetBlock<T> {
    added(eventData: IPipelineMessageType<T>, eventState: EventState): void;
    removed(eventData: IPipelineMessageType<T>, eventState: EventState): void;
    updated(eventData: IPipelineMessageType<T>, eventState: EventState): void;
}
export interface ILinkOptions {
}
export interface ISourceEvent<T> {
    updatedObservable: Observable<IPipelineMessageType<T>>;
    addedObservable: Observable<IPipelineMessageType<T>>;
    removedObservable: Observable<IPipelineMessageType<T>>;
}
export interface ISourceBlock<T> extends ISourceEvent<T> {
    linkTo(target: ITargetBlock<T>, options?: ILinkOptions): void;
    unlinkFrom(target: ITargetBlock<T>): ITilePipelineLink<T> | undefined;
}
export interface ITilePipelineLink<T> extends IDisposable {
    source: ISourceBlock<T>;
    target: ITargetBlock<T>;
    options?: ILinkOptions;
}
export interface ITilePipelineComponent extends IDisposable {
    name?: string;
}
export interface ITileSelectionContext {
    setContext(state: Nullable<ITileNavigationState>, display: Nullable<ITileDisplay>, metrics?: ITileMetrics, dispatchEvent?: boolean): void;
}
export interface ITileView extends ITilePipelineComponent, ISourceBlock<ITileAddress>, ITileSelectionContext {
}
export interface ITileProducer<T> extends ITilePipelineComponent, ITargetBlock<ITileAddress>, ISourceBlock<ITile<T>> {
    addProvider(provider: ITileProvider<T>): void;
    removeProvider(name: string): void;
}
export interface ITileRepository<T> {
    getActiveTiles(): Nullable<ITileCollection<T>>;
}
export interface ITileConsumer<T> extends ITilePipelineComponent, ITargetBlock<ITile<T>>, ITileRepository<T>, ISourceBlock<ITile<T>> {
}
export interface ITilePipeline<T> extends IDisposable {
    propertyChangedObservable: Observable<PropertyChangedEventArgs<ITilePipeline<T>, unknown>>;
    view?: ITileView;
    producer: ITileProducer<T>;
    consumer?: ITileConsumer<T>;
}
export interface ITilePipelineBuilder<T> {
    withConsumer(consumer: ITileConsumer<T>): ITilePipelineBuilder<T>;
    withProducer(producer: ITileProducer<T>): ITilePipelineBuilder<T>;
    withView(view: ITileView): ITilePipelineBuilder<T>;
    build(): ITilePipeline<T>;
}
export declare function IsTilePipelineBuilder<T>(b: unknown): b is ITilePipelineBuilder<T>;
