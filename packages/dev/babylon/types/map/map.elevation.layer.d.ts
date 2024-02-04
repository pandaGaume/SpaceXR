import { AbstractMesh } from "@babylonjs/core";
import { IMemoryCache } from "core/cache";
import { IDemInfos, DemLayer } from "core/dem";
import { ITileAddress, ITileDatasource, ITileMapLayerOptions, ITileProvider, Tile, TileContentType } from "core/tiles";
export declare class ElevationTile extends Tile<IDemInfos> {
    _surface?: AbstractMesh;
    constructor(x: number, y: number, levelOfDetail: number, data: IDemInfos);
}
export declare class ElevationLayer extends DemLayer {
    constructor(name: string, provider: ITileDatasource<IDemInfos, ITileAddress>, options?: ITileMapLayerOptions, enabled?: boolean);
    protected _buildProvider(provider: ITileDatasource<IDemInfos, ITileAddress>, cache?: IMemoryCache<string, TileContentType<IDemInfos>>): ITileProvider<IDemInfos>;
}
