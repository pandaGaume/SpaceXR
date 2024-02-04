import { AbstractMesh } from "@babylonjs/core";
import { IMemoryCache } from "core/cache";
import { IDemInfos, DemLayer } from "core/dem";
import { ITileAddress, ITileDatasource, ITileMapLayerOptions, ITileProvider, Tile, TileContentProvider, TileContentType, TileProvider } from "core/tiles";
import { TileBuilder } from "core/tiles/tiles.builder";

export class ElevationTile extends Tile<IDemInfos> {
    _surface?: AbstractMesh; // may be a mesh or an instance.

    public constructor(x: number, y: number, levelOfDetail: number, data: IDemInfos) {
        super(x, y, levelOfDetail, data);
    }
}

export class ElevationLayer extends DemLayer {
    public constructor(name: string, provider: ITileDatasource<IDemInfos, ITileAddress>, options?: ITileMapLayerOptions, enabled?: boolean) {
        super(name, provider, options, enabled);
    }

    protected _buildProvider(provider: ITileDatasource<IDemInfos, ITileAddress>, cache?: IMemoryCache<string, TileContentType<IDemInfos>>): ITileProvider<IDemInfos> {
        const contentProvider = new TileContentProvider<IDemInfos>(provider, cache);
        const factory = new TileBuilder<IDemInfos>().withMetrics(provider.metrics).withType(ElevationTile);
        return new TileProvider(contentProvider, factory);
    }
}
