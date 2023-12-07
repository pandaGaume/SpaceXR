import { IGeo2 } from "../../geography/geography.interfaces";
import { EventState } from "../../events/events.observable";
import { TileConsumerBase } from "./tiles.consumer";
import { ITileDisplay, ITileProducer, ITileProvider } from "./tiles.pipeline.interfaces";
import { ITile, ITileAddress, ITileDatasource } from "../tiles.interfaces";
export interface ITileMapOptions {
    center?: IGeo2;
    lod?: number;
    azimuth?: number;
    dataSources?: Array<ITileDatasource<any, ITileAddress>>;
}
export declare class TileMapBase<T> extends TileConsumerBase<T> {
    _display: ITileDisplay;
    _valid: boolean;
    constructor(id: string, display: ITileDisplay, options?: ITileMapOptions);
    addDataSources(...ds: Array<ITileDatasource<any, ITileAddress>>): void;
    addDataSource(ds: ITileDatasource<any, ITileAddress>): void;
    protected _createProducer(ds: ITileDatasource<any, ITileAddress>): ITileProducer<T>;
    protected _createProvider(ds: ITileDatasource<any, ITileAddress>): ITileProvider<T>;
    protected _onTileAdded(eventData: Array<ITile<T>>, eventState: EventState): void;
    protected _onTileRemoved(eventData: Array<ITile<T>>, eventState: EventState): void;
    protected _onTileUpdated(eventData: ITile<T>, eventState: EventState): void;
}
