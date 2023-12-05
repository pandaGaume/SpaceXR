import { Side } from "../../geometry/geometry.interfaces";
import { DemTileWebClient } from "../../dem/dem.tileclient";
import { TileWebClient, TileWebClientOptions } from "../tiles.client";
import { Float32TileCodec, Float32TileCodecOptionsBuilder, ImageTileCodec } from "../tiles.codecs.image";
import { EPSG3857 } from "../tiles.geography";
import { IPixelDecoder } from "../tiles.interfaces";
import { TileMetricsOptionsBuilder } from "../tiles.metrics";
import { WebTileUrlBuilder } from "../tiles.urlBuilder";

export enum MapBoxMap2DLayerCode {
    bathymetry = "mapbox.mapbox-bathymetry-v2",
    country= "mapbox.country-boundaries-v1",
    satellite = "mapbox.satellite",
    tansit="mapbox.transit-v2",
    terrain = "mapbox.mapbox-terrain-dem-v1",
    terrain_rgb= "mapbox.terrain-rgb",
    terrainv2= "mapbox.mapbox-terrain-v2",
    traffic= "mapbox.mapbox-traffic-v1",
}

export class MapBoxTerrainDemV1UrlBuilder extends WebTileUrlBuilder {
    // https://api.mapbox.com/raster/v1/mapbox.mapbox-terrain-dem-v1/14/8800/5372.webp?sku=101iNLHSEcgVj&access_token=pk.eyJ1IjoibWFwYm94IiwiYSI6ImNpejY5YzJzczA2ejIzM29hNGQ3emFsMXgifQ.az9JUrQP7klCgD3W-ueILQ

    public constructor(token: string, extension = "webp", ...types: (MapBoxMap2DLayerCode | string)[]) {
        super();
        this.withHost("api.mapbox.com")
            .withSecure(true)
            .withQuery(`access_token=${token}`)
            .withPath(`v4/${types}/{z}/{x}/{y}.{extension}90`)
            .withExtension(extension);
    }
    //FIXME : regarder pourquoi les images sont générer bizzarement
}

export class MapboxAltitudeDecoder implements IPixelDecoder {
    public static Shared = new MapboxAltitudeDecoder();

    public decode(pixels: Uint8ClampedArray, offset: number, target: Float32Array, targetOffset: number): number {
        const r = pixels[offset++];
        const g = pixels[offset++];
        const b = pixels[offset];

        let elevation = -10000 + ((r * 256 * 256 + g * 256 + b) * 0.1);

        target[targetOffset++] = elevation;
        return targetOffset;
    }
}

export class MapBox {
    private static readonly KEY = "mapbox";

    public static MaxLevelOfDetail = 14;
    public static MetricsOptions = new TileMetricsOptionsBuilder().withTileSize(256).withMaxLOD(MapBox.MaxLevelOfDetail).build();
    public static Metrics = new EPSG3857(MapBox.MetricsOptions);

    public static TerrainDemV1Client(token: string, options?: TileWebClientOptions) {
        const codecOptions = new Float32TileCodecOptionsBuilder().withInsets(1, Side.top).withInsets(1, Side.left).withInsets(1, Side.bottom).withInsets(1, Side.right).build();
        const elevationClient = new TileWebClient(
            `${MapBox.KEY}_elevation`,
            new MapBoxTerrainDemV1UrlBuilder(token, "webp", MapBoxMap2DLayerCode.terrain_rgb),
            new Float32TileCodec(MapboxAltitudeDecoder.Shared, codecOptions),
            MapBox.Metrics,
            options
        );
        console.log(elevationClient);
        return new DemTileWebClient(`${MapBox.KEY}_dem`, elevationClient);
    }

    public static TerrainClientBathymetry(token : string, options?: TileWebClientOptions) {
        return new TileWebClient(`${MapBox.KEY}_bathymetry`, new MapBoxTerrainDemV1UrlBuilder(token, "webp", MapBoxMap2DLayerCode.bathymetry), new ImageTileCodec(), MapBox.Metrics, options);
    }

    public static TerrainClientCountry(token : string, options?: TileWebClientOptions) {
        return new TileWebClient(`${MapBox.KEY}_country`, new MapBoxTerrainDemV1UrlBuilder(token, "webp", MapBoxMap2DLayerCode.country), new ImageTileCodec(), MapBox.Metrics, options);
    }

    public static TerrainClientSatellite(token : string, options?: TileWebClientOptions) {
        return new TileWebClient(`${MapBox.KEY}_satellite`, new MapBoxTerrainDemV1UrlBuilder(token, "webp", MapBoxMap2DLayerCode.satellite), new ImageTileCodec(), MapBox.Metrics, options);
    }

    public static TerrainClientTerrain(token : string, options?: TileWebClientOptions) {
        return new TileWebClient(`${MapBox.KEY}_terrain`, new MapBoxTerrainDemV1UrlBuilder(token, "webp", MapBoxMap2DLayerCode.terrain), new ImageTileCodec(), MapBox.Metrics, options);
    }

    public static TerrainClientTerrainRGB(token : string, options?: TileWebClientOptions) {
        return new TileWebClient(`${MapBox.KEY}_terrain_rgb`, new MapBoxTerrainDemV1UrlBuilder(token, "webp", MapBoxMap2DLayerCode.terrain_rgb), new ImageTileCodec(), MapBox.Metrics, options);
    }

    public static TerrainClientTerrainV2(token : string, options?: TileWebClientOptions) {
        return new TileWebClient(`${MapBox.KEY}_terrain_v2`, new MapBoxTerrainDemV1UrlBuilder(token, "webp", MapBoxMap2DLayerCode.terrainv2), new ImageTileCodec(), MapBox.Metrics, options);
    }

    public static TerrainClientTraffic(token : string, options?: TileWebClientOptions) {
        return new TileWebClient(`${MapBox.KEY}_traffic`, new MapBoxTerrainDemV1UrlBuilder(token, "webp", MapBoxMap2DLayerCode.traffic), new ImageTileCodec(), MapBox.Metrics, options);
    }
}
