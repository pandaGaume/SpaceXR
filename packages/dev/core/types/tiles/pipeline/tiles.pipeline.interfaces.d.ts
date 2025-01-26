import { EventState, Observable } from "../../events";
import { IDisposable, Nullable } from "../../types";
import { ITileAddress, ITileMetrics } from "../tiles.interfaces";
import { ITileNavigationState } from "../navigation/tiles.navigation.interfaces";
import { IDisplay } from "../map";
export type IPipelineMessageType<T> = Array<T>;
export type TargetCallbackFn<T> = (eventData: T, eventState: EventState) => void;
export interface ITargetBlock<T> {
    added?: TargetCallbackFn<IPipelineMessageType<T>>;
    removed?: TargetCallbackFn<IPipelineMessageType<T>>;
    updated?: TargetCallbackFn<IPipelineMessageType<T>>;
}
export declare function IsTargetBlock<T>(b: unknown): b is ITargetBlock<T>;
export interface ILinkOptions<T> {
    accept?: (data: T) => boolean;
    acceptAdded?: (data: T) => boolean;
    acceptRemoved?: (data: T) => boolean;
    acceptUpdated?: (data: T) => boolean;
}
export interface ISourceEvent<T> {
    updatedObservable: Observable<IPipelineMessageType<T>>;
    addedObservable: Observable<IPipelineMessageType<T>>;
    removedObservable: Observable<IPipelineMessageType<T>>;
}
export interface ISourceBlock<T> extends ISourceEvent<T> {
    linkTo(target: ITargetBlock<T>, options?: ILinkOptions<T>, ...args: Array<any>): void;
    unlinkFrom(target: ITargetBlock<T>, ...args: Array<any>): ITilePipelineLink<T> | undefined;
    links?: Array<ITilePipelineLink<T>>;
}
export interface ITransformBlock<TInput, TOutput> extends ITargetBlock<TInput>, ISourceBlock<TOutput> {
}
export interface ITilePipelineLink<T> extends IDisposable {
    source: ISourceBlock<T>;
    target: ITargetBlock<T>;
    options?: ILinkOptions<T>;
    forwardAdded(eventData: IPipelineMessageType<T>, eventState: EventState): void;
    forwardRemoved(eventData: IPipelineMessageType<T>, eventState: EventState): void;
    forwardUpdated(eventData: IPipelineMessageType<T>, eventState: EventState): void;
}
export interface ITilePipelineComponent extends IDisposable {
    name?: string;
}
export interface ITileMipMapping {
    split?(tile: ITileAddress): void;
    stitch?(...tile: Array<ITileAddress>): void;
}
export declare function IsTileMipMapping(b: unknown): b is ITileMipMapping;
export interface ITileSelectionContextOptions {
    dispatchEvent?: boolean;
    zoomOffset?: number;
}
export interface ITileSelectionContext {
    setContext(state: Nullable<ITileNavigationState>, display: Nullable<IDisplay>, metrics: ITileMetrics, options?: ITileSelectionContextOptions): void;
}
export declare function hasTileSelectionContext(b: unknown): b is ITileSelectionContext;
export interface ITileView extends ITilePipelineComponent, ISourceBlock<ITileAddress>, ITileSelectionContext, ITileMipMapping {
}
export interface IHasView {
    view: ITileView;
}
export declare function isViewProxy(b: unknown): b is IHasView;
