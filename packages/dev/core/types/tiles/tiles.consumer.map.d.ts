import { IGeo2 } from "../geography/geography.interfaces";
import { EventState } from "../events/events.observable";
import { TileConsumerBase } from "./tiles.consumer";
import { ITile } from "./tiles.interfaces";
import { ITileMapApi } from "./tiles.interfaces.api";
import { ITileProvider } from "./tiles.interfaces.pipeline";
export declare class TileMapOptions {
    center?: IGeo2;
    lod?: number;
    azimuth?: number;
}
export declare class TileMapBase<T> extends TileConsumerBase<T> {
    _api: ITileMapApi;
    constructor(id: string, provider: ITileProvider<T>, api: ITileMapApi);
    get api(): ITileMapApi;
    protected onTileAdded(eventData: ITile<T>[], eventState: EventState): void;
    protected onTileRemoved(eventData: ITile<T>[], eventState: EventState): void;
    protected onTileUpdated(eventData: ITile<T>[], eventState: EventState): void;
}
