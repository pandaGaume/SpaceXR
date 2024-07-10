import { EPSG3857, MapBox, TileWebClient, TileWebClientOptions, WebTileUrlBuilder } from "core/tiles";
import { IVectorTileContent } from "../tiles.vector.interfaces";
import { VectorTileCodec } from "../codecs";

export class MapBoxVectorUrlBuilder extends WebTileUrlBuilder {
    // https://api.mapbox.com/v4/mapbox.mapbox-terrain-v2/1/0/0.mvt?access_token={token}
    public constructor(token: string, tileSetIds: string, extension: string = "mvt") {
        super();
        this.withHost("api.mapbox.com").withSecure(true).withQuery(`access_token=${token}`).withPath(`v4/${tileSetIds}/{z}/{x}/{y}.{extension}`).withExtension(extension);
    }
}

// module augmentation.
declare module "core/tiles/vendors/tiles.vendors.mapbox" {
    export interface MapBox {}
    namespace MapBox {
        function VectorClient(token: string, tileSetIds: string, options?: TileWebClientOptions): TileWebClient<IVectorTileContent>;
    }
}

export enum MapBoxTileSetIds {
    StreetsV8 = "mapbox.mapbox-streets-v8",
    Terrain = "mapbox.mapbox-terrain-v2",
    Outdoors = "mapbox.mapbox-outdoors-v11",
    Traffic = "mapbox.mapbox-traffic-v1",
}

MapBox.VectorClient = function (token: string, tileSetIds: string = MapBoxTileSetIds.Terrain, options?: TileWebClientOptions): TileWebClient<IVectorTileContent> {
    const metrics = new EPSG3857({ maxLOD: MapBox.MaxLevelOfDetail, tileSize: 512 });
    return new TileWebClient<IVectorTileContent>(`${token}`, new MapBoxVectorUrlBuilder(token, tileSetIds), new VectorTileCodec(), metrics, options);
};
