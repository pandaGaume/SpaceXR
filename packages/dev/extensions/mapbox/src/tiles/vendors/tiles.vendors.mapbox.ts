import { DemTileWebClient } from "core/dem";
import { Side } from "core/geometry";
import { EPSG3857, Float32TileCodec, Float32TileCodecOptionsBuilder, IPixelDecoder, TileWebClient, TileWebClientOptions, WebTileUrlBuilder } from "core/tiles";
import { VectorTileCodec, VectorToImageTileCodec } from "../codecs";
import { IVectorStyle } from "core/tiles/vector/tiles.vector.style.interface";
import { VectorTile } from "@mapbox/vector-tile";

export class MapBoxTerrainDemV1UrlBuilder extends WebTileUrlBuilder {
    // https://api.mapbox.com/raster/v1/mapbox.mapbox-terrain-dem-v1/14/8800/5372.webp?sku=101iNLHSEcgVj&access_token={token}
    public constructor(token: string, extension = "webp") {
        super();
        this.withHost("api.mapbox.com")
            .withSecure(true)
            .withQuery(`access_token=${token}`)
            .withPath(`raster/v1/mapbox.mapbox-terrain-dem-v1/{z}/{x}/{y}.{extension}`)
            .withExtension(extension);
    }
}

export class MapboxAltitudeDecoder implements IPixelDecoder<Float32Array> {
    public static Shared = new MapboxAltitudeDecoder();

    public decode(pixels: Uint8ClampedArray, offset: number, target: Float32Array, targetOffset: number): number {
        const r = pixels[offset++];
        const g = pixels[offset++];
        const b = pixels[offset];

        target[targetOffset++] = -10000 + (r * 256 * 256 + g * 256 + b) * 0.1;
        return targetOffset;
    }
}

export enum MapBoxTileSetIds {
    StreetsV8 = "mapbox.mapbox-streets-v8",
    Terrain = "mapbox.mapbox-terrain-v2",
    Outdoors = "mapbox.mapbox-outdoors-v11",
    Traffic = "mapbox.mapbox-traffic-v1",
}

export class MapBoxVectorUrlBuilder extends WebTileUrlBuilder {
    // https://api.mapbox.com/v4/mapbox.mapbox-terrain-v2/1/0/0.mvt?access_token={token}
    public constructor(token: string, tileSetIds: string, extension: string = "mvt") {
        super();
        this.withHost("api.mapbox.com").withSecure(true).withQuery(`access_token=${token}`).withPath(`v4/${tileSetIds}/{z}/{x}/{y}.{extension}`).withExtension(extension);
    }
}

export const MaxLevelOfDetail = 21;
export const KEY = "mapbox";
export const Attribution = "© Mapbox © OpenStreetMap";

export const TerrainDemV1Client = function (token: string, options?: TileWebClientOptions) {
    const metrics = new EPSG3857({ maxLOD: MaxLevelOfDetail, tileSize: 512 });
    const codecOptions = new Float32TileCodecOptionsBuilder().withInsets(1, Side.top).withInsets(1, Side.left).withInsets(1, Side.bottom).withInsets(1, Side.right).build();
    const elevationClient = new TileWebClient(
        `${KEY}_elevation`,
        new MapBoxTerrainDemV1UrlBuilder(token),
        new Float32TileCodec(MapboxAltitudeDecoder.Shared, codecOptions),
        metrics,
        options
    );
    return new DemTileWebClient(`${KEY}_dem`, elevationClient);
};

export const VectorToImageClient = function (
    token: string,
    tileSetIds: string = MapBoxTileSetIds.Terrain,
    style: IVectorStyle,
    options?: TileWebClientOptions
): TileWebClient<ImageBitmap> {
    const metrics = new EPSG3857({ maxLOD: MaxLevelOfDetail, tileSize: 256 });
    return new TileWebClient<ImageBitmap>(`${token}`, new MapBoxVectorUrlBuilder(token, tileSetIds), new VectorToImageTileCodec(metrics, style), metrics, options);
};

export const VectorClient = function (token: string, tileSetIds: string = MapBoxTileSetIds.Terrain, options?: TileWebClientOptions): TileWebClient<VectorTile> {
    const metrics = new EPSG3857({ maxLOD: MaxLevelOfDetail, tileSize: 256 });
    return new TileWebClient<VectorTile>(`${token}`, new MapBoxVectorUrlBuilder(token, tileSetIds), new VectorTileCodec(), metrics, options);
};
