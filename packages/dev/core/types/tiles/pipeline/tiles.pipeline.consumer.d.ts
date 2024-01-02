import { EventState } from "../../events/events.observable";
import { IPipelineMessageType, ITileConsumer } from "./tiles.pipeline.interfaces";
import { ITile } from "../tiles.interfaces";
import { ValidableBase } from "../../types";
export declare class TileConsumerBase<T> extends ValidableBase implements ITileConsumer<T> {
    _id: string;
    constructor(id: string);
    get name(): string;
    added(eventData: IPipelineMessageType<ITile<T>>, eventState: EventState): void;
    removed(eventData: IPipelineMessageType<ITile<T>>, eventState: EventState): void;
    updated(eventData: IPipelineMessageType<ITile<T>>, eventState: EventState): void;
    dispose(): void;
    protected _onTileAdded(eventData: Array<ITile<T>>, eventState: EventState): void;
    protected _onTileRemoved(eventData: Array<ITile<T>>, eventState: EventState): void;
    protected _onTileUpdated(eventData: Array<ITile<T>>, eventState: EventState): void;
}
