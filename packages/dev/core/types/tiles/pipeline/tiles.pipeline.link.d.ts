import { Nullable } from "../../types";
import { ILinkOptions, IPipelineMessageType, ISourceBlock, ITargetBlock, ITilePipelineLink } from "./tiles.pipeline.interfaces";
import { EventState, Observer } from "../../events/events.observable";
export declare class TilePipelineLink<T> implements ITilePipelineLink<T> {
    _source: ISourceBlock<T>;
    _target: ITargetBlock<T>;
    _options?: ILinkOptions;
    _updatedObserver: Nullable<Observer<IPipelineMessageType<T>>>;
    _addedObserver: Nullable<Observer<IPipelineMessageType<T>>>;
    _removedObserver: Nullable<Observer<IPipelineMessageType<T>>>;
    constructor(source: ISourceBlock<T>, target: ITargetBlock<T>, options?: ILinkOptions);
    get source(): ISourceBlock<T>;
    get target(): ITargetBlock<T>;
    get options(): ILinkOptions | undefined;
    dispose(): void;
    protected _onAdded(eventData: IPipelineMessageType<T>, eventState: EventState): void;
    protected _onRemoved(eventData: IPipelineMessageType<T>, eventState: EventState): void;
    protected _onUpdated(eventData: IPipelineMessageType<T>, eventState: EventState): void;
}
