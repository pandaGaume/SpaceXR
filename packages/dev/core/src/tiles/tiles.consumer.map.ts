import { IGeo2 } from "../geography/geography.interfaces";
import { EventState } from "../events/events.observable";
import { TileConsumerBase } from "./tiles.consumer";
import { ITile } from "./tiles.interfaces";
import { ITileMapApi } from "./tiles.interfaces.api";
import { ITileProvider } from "./tiles.interfaces.pipeline";

export class TileMapOptions {
    center?: IGeo2;
    lod?: number;
    azimuth?: number;
}

export class TileMapBase<T> extends TileConsumerBase<T> {
    _api: ITileMapApi;

    public constructor(id: string, provider: ITileProvider<T>, api: ITileMapApi) {
        super(id, provider);
        this._api = api;
    }

    public get api(): ITileMapApi {
        return this._api;
    }

    protected onTileAdded(eventData: ITile<T>[], eventState: EventState): void {}

    protected onTileRemoved(eventData: ITile<T>[], eventState: EventState): void {}

    protected onTileUpdated(eventData: ITile<T>[], eventState: EventState): void {}
}
