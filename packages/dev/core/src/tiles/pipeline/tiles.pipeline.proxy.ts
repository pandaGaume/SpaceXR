import { EventState } from "../../events";
import { IPipelineMessageType, ITargetBlock } from "./tiles.pipeline.interfaces";

export class TargetProxy<T> implements ITargetBlock<T> {
    _delegate: ITargetBlock<T>;

    constructor(delegate: ITargetBlock<T>) {
        this._delegate = delegate;
    }
    public added(eventData: IPipelineMessageType<T>, eventState: EventState): void {
        this._delegate.added(eventData, eventState);
    }

    public removed(eventData: IPipelineMessageType<T>, eventState: EventState): void {
        this._delegate.removed(eventData, eventState);
    }

    public updated(eventData: IPipelineMessageType<T>, eventState: EventState): void {
        this._delegate.updated(eventData, eventState);
    }
}
