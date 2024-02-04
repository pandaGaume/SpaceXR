import { ITileAddress, ITileDatasource, ITileMapLayerOptions, ITileProvider, TileMapLayer } from "../tiles";
import { IDemInfos } from "./dem.interfaces";
export declare class DemLayer extends TileMapLayer<IDemInfos> {
    constructor(name: string, provider: ITileProvider<IDemInfos> | ITileDatasource<IDemInfos, ITileAddress>, options?: ITileMapLayerOptions, enabled?: boolean);
}
