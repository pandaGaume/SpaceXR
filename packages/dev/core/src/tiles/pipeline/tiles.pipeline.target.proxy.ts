import { IPipelineMessageType, ITargetBlock, TargetCallbackFn } from "./tiles.pipeline.interfaces";

export class TargetProxy<T> implements ITargetBlock<T> {
    _added: TargetCallbackFn<IPipelineMessageType<T>>;
    _removed: TargetCallbackFn<IPipelineMessageType<T>>;
    _updated: TargetCallbackFn<IPipelineMessageType<T>>;

    public constructor(added: TargetCallbackFn<IPipelineMessageType<T>>, removed: TargetCallbackFn<IPipelineMessageType<T>>, updated: TargetCallbackFn<IPipelineMessageType<T>>) {
        this._added = added;
        this._removed = removed;
        this._updated = updated;
    }
    public get added(): TargetCallbackFn<IPipelineMessageType<T>> {
        return this._added;
    }
    public get removed(): TargetCallbackFn<IPipelineMessageType<T>> {
        return this._removed;
    }
    public get updated(): TargetCallbackFn<IPipelineMessageType<T>> {
        return this._updated;
    }
}
