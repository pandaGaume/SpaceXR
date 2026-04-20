import { EventState, Observable } from "../events";
import { IDisposable } from "../types";

/**
 * Generic, domain-agnostic dataflow primitives.
 *
 * Blocks exchange batched messages via three channels (added / removed / updated),
 * wired by links. Same shape used by tiles/pipeline, streaming, and any future
 * pipeline that wants to consume/produce sequences of T.
 */

/** Batch payload carried by pipeline events. */
export type IPipelineMessageType<T> = Array<T>;

/** Callback signature for target-side block handlers. */
export type TargetCallbackFn<T> = (eventData: T, eventState: EventState) => void;

/**
 * A block that consumes batches of T. Any of the three channels may be undefined
 * if the block does not care about that lifecycle event.
 */
export interface ITargetBlock<T> {
    added?: TargetCallbackFn<IPipelineMessageType<T>>;
    removed?: TargetCallbackFn<IPipelineMessageType<T>>;
    updated?: TargetCallbackFn<IPipelineMessageType<T>>;
}

export function IsTargetBlock<T>(b: unknown): b is ITargetBlock<T> {
    if (b === null || typeof b !== "object") return false;
    return (<ITargetBlock<T>>b).added !== undefined || (<ITargetBlock<T>>b).removed !== undefined || (<ITargetBlock<T>>b).updated !== undefined;
}

/**
 * Per-link filters. `accept` applies to every channel unless a specific
 * acceptAdded / acceptRemoved / acceptUpdated is provided.
 */
export interface ILinkOptions<T> {
    accept?: (data: T) => boolean;
    acceptAdded?: (data: T) => boolean;
    acceptRemoved?: (data: T) => boolean;
    acceptUpdated?: (data: T) => boolean;
}

/**
 * The three observables a source-side block exposes. Subscribers receive batches
 * of T through them.
 */
export interface ISourceEvent<T> {
    /** Emitted when one or more items are updated. */
    updatedObservable: Observable<IPipelineMessageType<T>>;
    /** Emitted when one or more items enter the active set. */
    addedObservable: Observable<IPipelineMessageType<T>>;
    /** Emitted when one or more items leave the active set. */
    removedObservable: Observable<IPipelineMessageType<T>>;
}

/**
 * A block that produces batches of T. `linkTo` connects a target; `unlinkFrom`
 * disposes an existing link.
 */
export interface ISourceBlock<T> extends ISourceEvent<T> {
    linkTo(target: ITargetBlock<T>, options?: ILinkOptions<T>, ...args: Array<any>): void;
    unlinkFrom(target: ITargetBlock<T>, ...args: Array<any>): IPipelineLink<T> | undefined;
    links?: Array<IPipelineLink<T>>;
}

/** A block that consumes TInput and produces TOutput. */
export interface ITransformBlock<TInput, TOutput> extends ITargetBlock<TInput>, ISourceBlock<TOutput> {}

/**
 * A live connection between a source and a target. Disposing it disconnects
 * both sides and releases observer registrations.
 */
export interface IPipelineLink<T> extends IDisposable {
    source: ISourceBlock<T>;
    target: ITargetBlock<T>;
    options?: ILinkOptions<T>;

    forwardAdded(eventData: IPipelineMessageType<T>, eventState: EventState): void;
    forwardRemoved(eventData: IPipelineMessageType<T>, eventState: EventState): void;
    forwardUpdated(eventData: IPipelineMessageType<T>, eventState: EventState): void;
}
