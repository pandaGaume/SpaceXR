import { Side } from "../../geometry/geometry.interfaces";
import { DemTileWebClient } from "../../dem/dem.tileclient";
import { TileWebClient, TileWebClientOptions } from "../tiles.client";
import { Float32TileCodec, Float32TileCodecOptionsBuilder } from "../codecs/tiles.codecs.image";
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
    private static readonly KEY = "mapbox";
    public static MaxLevelOfDetail = 14;

    public static TerrainDemV1Client(token: string, options?: TileWebClientOptions) {
        let mo = new TileMetricsOptionsBuilder().withTileSize(512).withMaxLOD(MapBox.MaxLevelOfDetail);
        const metrics = new EPSG3857(mo.build());
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
}
