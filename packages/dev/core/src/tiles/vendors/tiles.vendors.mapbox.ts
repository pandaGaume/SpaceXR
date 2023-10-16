import { Side } from "../../geometry/geometry.interfaces";
import { DemTileWebClient } from "../../dem/dem.tileclient";
import { TileWebClient, TileWebClientOptions } from "../tiles.client";
import { Float32TileCodec, Float32TileCodecOptionsBuilder, ImageTileCodec } from "../tiles.codecs.image";
import { EPSG3857 } from "../tiles.geography";
import { IPixelDecoder } from "../tiles.interfaces";
import { TileMetricsOptionsBuilder } from "../tiles.metrics";
import { WebTileUrlBuilder } from "../tiles.urlBuilder";

export class MapBoxTerrainDemV1UrlBuilder extends WebTileUrlBuilder {
    // https://api.mapbox.com/raster/v1/mapbox.mapbox-terrain-dem-v1/14/8800/5372.webp?sku=101iNLHSEcgVj&access_token=pk.eyJ1IjoibWFwYm94IiwiYSI6ImNpejY5YzJzczA2ejIzM29hNGQ3emFsMXgifQ.az9JUrQP7klCgD3W-ueILQ
    public constructor(token: string, extension = "webp") {
        super();
        this.withHost("api.mapbox.com")
            .withSecure(true)
            .withQuery(`access_token=${token}`)
            .withPath(`raster/v1/mapbox.mapbox-terrain-dem-v1/{z}/{x}/{y}.{extension}`)
            .withExtension(extension);
    }
}

export class MapBoxStaticTilesUrlBuilder extends WebTileUrlBuilder {
    public constructor(username: string, styleId: string, token: string, tileSize = 256) {
        super();
        this.withHost("api.mapbox.com")
            .withSecure(true)
            .withQuery(`access_token=${token}`)
            .withPath(`styles/v1/${username}/${styleId}/tiles/${tileSize}/{z}/{x}/{y}`);
    }
}

export class MapboxAltitudeDecoder implements IPixelDecoder {
    public static Shared = new MapboxAltitudeDecoder();

    public decode(pixels: Uint8ClampedArray, offset: number, target: Float32Array, targetOffset: number): number {
        const r = pixels[offset++];
        const g = pixels[offset++];
        const b = pixels[offset];

        target[targetOffset++] = -10000 + (r * 256 * 256 + g * 256 + b) * 0.1;
        return targetOffset;
    }
}

export class MapBox {
    public static MaxLevelOfDetail = 14;
    public static MetricsOptions = new TileMetricsOptionsBuilder().withTileSize(256).withMaxLOD(19).build();
    public static Metrics = new EPSG3857(MapBox.MetricsOptions);

    public static TerrainDemV1Client(token: string, options?: TileWebClientOptions) {
        let mo = new TileMetricsOptionsBuilder().withTileSize(512).withMaxLOD(MapBox.MaxLevelOfDetail);
        const metrics = new EPSG3857(mo.build());
        const codecOptions = new Float32TileCodecOptionsBuilder().withInsets(1, Side.top).withInsets(1, Side.left).withInsets(1, Side.bottom).withInsets(1, Side.right).build();
        const elevationClient = new TileWebClient(new MapBoxTerrainDemV1UrlBuilder(token), new Float32TileCodec(MapboxAltitudeDecoder.Shared, codecOptions), metrics, options);
        return new DemTileWebClient(elevationClient);
    }

    private static StaticTilesClient2d(styleId: string, options?: TileWebClientOptions) {
        const urlBuilder = new MapBoxStaticTilesUrlBuilder('clongeanie',
            styleId,
            'pk.eyJ1IjoiY2xvbmdlYW5pZSIsImEiOiJjajZ3YWJ3bTQxcDk5Mnhxc29lbzMzdm54In0.-hY_qdTaIeZcZlRivs947Q',
            MapBox.MetricsOptions.tileSize);
        return new TileWebClient(urlBuilder, new ImageTileCodec(), MapBox.Metrics, options);
    }

    public static BlueMonoClient(options?: TileWebClientOptions) {
        return this.StaticTilesClient2d('ck17rscm7076b1cqp29yhd8y6', options);
    }

    public static VintageClient(options?: TileWebClientOptions) {
        return this.StaticTilesClient2d('cjajv9mklb5xe2smu9t3wgk3c', options);
    }

    public static HillShadingClient(options?: TileWebClientOptions) {
        return this.StaticTilesClient2d('cjftsbqly37892so0h4mcnvik', options);
    }
}
