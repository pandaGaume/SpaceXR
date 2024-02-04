import { ITileAddress, ITileDatasource, ITileMapLayerOptions, ITileProvider, TileMapLayer } from "../tiles";
import { IDemInfos } from "./dem.interfaces";

export class DemLayer extends TileMapLayer<IDemInfos> {
    public constructor(name: string, provider: ITileProvider<IDemInfos> | ITileDatasource<IDemInfos, ITileAddress>, options?: ITileMapLayerOptions, enabled?: boolean) {
        super(name, provider, options, enabled);
    }
}
