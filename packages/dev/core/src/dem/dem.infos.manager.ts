import { TileContentManager } from "core/tiles/tiles.content.manager";
import { ITileAddress, ITileDatasource, TileContent } from "core/tiles/tiles.interfaces";
import { IDemInfos } from "./dem.interfaces";
import { IMemoryCache } from "core/utils/cache";

export class DemInfosManager<T extends IDemInfos> extends TileContentManager<T> {
    public constructor(datasource: ITileDatasource<T, ITileAddress>, cache?: IMemoryCache<string, TileContent<T>>) {
        super(datasource, cache);
    }
    protected buildAlternativeTileContent(address: ITileAddress): TileContent<T> {
        return null;
    }
}
