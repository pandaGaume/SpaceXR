import { EventState } from "../../events/events.observable";
import { IPipelineMessageType, ITileConsumer } from "./tiles.pipeline.interfaces";
import { ITile } from "../tiles.interfaces";
import { ValidableBase } from "../../types";

export class TileConsumerBase<T> extends ValidableBase implements ITileConsumer<T> {
    _id: string;

    public constructor(id: string) {
        super();
        this._id = id;
    }

    public get id(): string {
        return this._id;
    }

    /// begin ITargetBlock
    public added(eventData: IPipelineMessageType<ITile<T>>, eventState: EventState): void {
        const data = Array.isArray(eventData) ? eventData : [eventData];
        this._onTileAdded(data, eventState);
    }
    public removed(eventData: IPipelineMessageType<ITile<T>>, eventState: EventState): void {
        const data = Array.isArray(eventData) ? eventData : [eventData];
        this._onTileRemoved(data, eventState);
    }
    public updated(eventData: IPipelineMessageType<ITile<T>>, eventState: EventState): void {
        const data = Array.isArray(eventData) ? eventData : [eventData];
        this._onTileUpdated(data, eventState);
    }
    /// end ITargetBlock

    public dispose() {}

    protected _onTileAdded(eventData: Array<ITile<T>>, eventState: EventState): void {
        /* nothing to do here, may be override by subclass */
    }
    protected _onTileRemoved(eventData: Array<ITile<T>>, eventState: EventState): void {
        /* nothing to do here, may be override by subclass */
    }
    protected _onTileUpdated(eventData: Array<ITile<T>>, eventState: EventState): void {
        /* nothing to do here, may be override by subclass */
    }
}
