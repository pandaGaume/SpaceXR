import { EventState, Observable, PropertyChangedEventArgs } from "../../events";
import { IDisposable, Nullable } from "../../types";
import { ITile, ITileAddress, ITileMetrics, ITileProvider } from "../tiles.interfaces";
import { ITileNavigationState } from "../navigation/tiles.navigation.interfaces";
import { ISize2 } from "../../geometry";

export type IPipelineMessageType<T> = Array<T>;

export interface ITargetBlock<T> {
    added(eventData: IPipelineMessageType<T>, eventState: EventState): void;
    removed(eventData: IPipelineMessageType<T>, eventState: EventState): void;
    updated(eventData: IPipelineMessageType<T>, eventState: EventState): void;
}

export function IsTargetBlock<T>(b: unknown): b is ITargetBlock<T> {
    if (b === null || typeof b !== "object") return false;
    return (<ITargetBlock<T>>b).added !== undefined && (<ITargetBlock<T>>b).removed !== undefined && (<ITargetBlock<T>>b).updated !== undefined;
}

export interface ILinkOptions {}

export interface ISourceEvent<T> {
    /// <summary> messaged when a tile is updated </summary>
    updatedObservable: Observable<IPipelineMessageType<T>>;
    /// <summary> messaged when a tile is added </summary>
    addedObservable: Observable<IPipelineMessageType<T>>;
    /// <summary> messaged when a tile is removed </summary>
    removedObservable: Observable<IPipelineMessageType<T>>;
}

export interface ISourceBlock<T> extends ISourceEvent<T> {
    linkTo(target: ITargetBlock<T>, options?: ILinkOptions, ...args: Array<any>): void;
    unlinkFrom(target: ITargetBlock<T>, ...args: Array<any>): ITilePipelineLink<T> | undefined;
    links?: Array<ITilePipelineLink<T>>;
}

export interface ITransformBlock<TInput, TOutput> extends ITargetBlock<TInput>, ISourceBlock<TOutput> {}

export interface ITilePipelineLink<T> extends IDisposable {
    source: ISourceBlock<T>;
    target: ITargetBlock<T>;
    options?: ILinkOptions;
}

export interface ITilePipelineComponent extends IDisposable {
    name?: string;
}

export interface ITileSelectionContext {
    setContext(state: Nullable<ITileNavigationState>, display: Nullable<ISize2>, metrics?: ITileMetrics, dispatchEvent?: boolean): void;
}

/// <summary>
/// The View component is tasked with selecting appropriate tile addresses, guided by the Tile Metrics and navigation properties. Its role is expanded to include the following:
/// - Tile Selection Based on Navigation Properties: Considers the geographic center, azimuth, and level of detail in tile selection, ensuring relevance and accuracy.
/// - Dimension and Scalability: Defines the dimension in unitless TileXY units, enabling flexibility and adaptability to different screen sizes and resolutions.
/// - Event Management Through Observable Pattern: Crucially, the View is responsible for managing events using the observable pattern. It sends notifications about 'Added'
///   and 'Removed' TileAddresses, allowing other components of the system to react and update accordingly. This feature is vital for ensuring that the system remains dynamic
///   and responsive to changes, such as user navigation or zoom adjustments.
/// </summary>
export interface ITileView extends ITilePipelineComponent, ISourceBlock<ITileAddress>, ITileSelectionContext {}

export interface ITileProducer<T> extends ITilePipelineComponent, ITargetBlock<ITileAddress>, ISourceBlock<ITile<T>> {
    addProvider(provider: ITileProvider<T>): void;
    removeProvider(name: string): void;
}

export interface ITileConsumer<T> extends ITilePipelineComponent, ITransformBlock<ITile<T>, ITile<T>> {}

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

export function IsTilePipelineBuilder<T>(b: unknown): b is ITilePipelineBuilder<T> {
    if (b === null || typeof b !== "object") return false;
    return (
        (<ITilePipelineBuilder<T>>b).build !== undefined &&
        (<ITilePipelineBuilder<T>>b).withProducer !== undefined &&
        (<ITilePipelineBuilder<T>>b).withView !== undefined &&
        (<ITilePipelineBuilder<T>>b).withConsumer !== undefined
    );
}
