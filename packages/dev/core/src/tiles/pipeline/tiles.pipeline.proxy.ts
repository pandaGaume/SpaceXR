import { EventState } from "../../events";
import { Assert } from "../../utils";
import { IPipelineMessageType, ITargetBlock } from "./tiles.pipeline.interfaces";

export class TargetProxy<T> implements ITargetBlock<T> {
    _delegate: ITargetBlock<T>;
    _target?: any;

    constructor(delegate: ITargetBlock<T>, target?: any) {
        Assert(delegate !== null && delegate !== undefined);
        this._delegate = delegate;
        this._target = target;
    }
    public added(eventData: IPipelineMessageType<T>, eventState: EventState): void {
        this._delegate.added?.call(this._target ?? this._delegate, eventData, eventState);
    }

    public removed(eventData: IPipelineMessageType<T>, eventState: EventState): void {
        this._delegate.removed?.call(this._target ?? this._delegate, eventData, eventState);
    }

    public updated(eventData: IPipelineMessageType<T>, eventState: EventState): void {
        this._delegate.updated?.call(this._target ?? this._delegate, eventData, eventState);
    }
}
