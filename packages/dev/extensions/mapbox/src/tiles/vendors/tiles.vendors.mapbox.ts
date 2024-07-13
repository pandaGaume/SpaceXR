import { DemTileWebClient } from "core/dem";
import { Side } from "core/geometry";
import { EPSG3857, Float32TileCodec, Float32TileCodecOptionsBuilder, IPixelDecoder, IVectorTileContent, TileWebClient, TileWebClientOptions, WebTileUrlBuilder } from "core/tiles";
import { VectorTileCodec } from "../codecs";

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

export class MapBox {
    private static readonly KEY = "mapbox";
    public static MaxLevelOfDetail = 14;

    public static TerrainDemV1Client(token: string, options?: TileWebClientOptions) {
        const metrics = new EPSG3857({ maxLOD: MapBox.MaxLevelOfDetail, tileSize: 512 });
        const codecOptions = new Float32TileCodecOptionsBuilder().withInsets(1, Side.top).withInsets(1, Side.left).withInsets(1, Side.bottom).withInsets(1, Side.right).build();
        const elevationClient = new TileWebClient(
            `${MapBox.KEY}_elevation`,
            new MapBoxTerrainDemV1UrlBuilder(token),
            new Float32TileCodec(MapboxAltitudeDecoder.Shared, codecOptions),
            metrics,
            options
        );
        return new DemTileWebClient(`${MapBox.KEY}_dem`, elevationClient);
    }

    public static VectorClient(token: string, tileSetIds: string, options?: TileWebClientOptions): TileWebClient<IVectorTileContent> {
        const metrics = new EPSG3857({ maxLOD: MapBox.MaxLevelOfDetail, tileSize: 512 });
        return new TileWebClient<IVectorTileContent>(`${token}`, new MapBoxVectorUrlBuilder(token, tileSetIds), new VectorTileCodec(), metrics, options);
    }
}
