import { DemTileWebClient } from "../../dem/dem.tileclient";
import { TileWebClient, TileWebClientOptions } from "../tiles.client";
import { EPSG3857 } from "../tiles.geography";
import { IPixelDecoder } from "../tiles.interfaces";
import { WebTileUrlBuilder } from "../tiles.urlBuilder";
export declare enum MapBoxMap2DLayerCode {
    bathymetry = "mapbox.mapbox-bathymetry-v2",
    country = "mapbox.country-boundaries-v1",
    satellite = "mapbox.satellite",
    tansit = "mapbox.transit-v2",
    terrain = "mapbox.mapbox-terrain-dem-v1",
    terrain_rgb = "mapbox.terrain-rgb",
    terrainv2 = "mapbox.mapbox-terrain-v2",
    traffic = "mapbox.mapbox-traffic-v1"
}
export declare class MapBoxTerrainDemV1UrlBuilder extends WebTileUrlBuilder {
    private static TOKEN;
    static Bathymetry: MapBoxTerrainDemV1UrlBuilder;
    static Country: MapBoxTerrainDemV1UrlBuilder;
    static Satellite: MapBoxTerrainDemV1UrlBuilder;
    static Terrain: MapBoxTerrainDemV1UrlBuilder;
    static TerrainRGB: MapBoxTerrainDemV1UrlBuilder;
    static TerrainV2: MapBoxTerrainDemV1UrlBuilder;
    static Traffic: MapBoxTerrainDemV1UrlBuilder;
    static Transit: MapBoxTerrainDemV1UrlBuilder;
    constructor(token: string, extension?: string, ...types: (MapBoxMap2DLayerCode | string)[]);
}
export declare class MapboxAltitudeDecoder implements IPixelDecoder {
    static Shared: MapboxAltitudeDecoder;
    decode(pixels: Uint8ClampedArray, offset: number, target: Float32Array, targetOffset: number): number;
}
export declare class MapBox {
    private static readonly KEY;
    static MaxLevelOfDetail: number;
    static MetricsOptions: import("../tiles.interfaces").ITileMetricsOptions;
    static Metrics: EPSG3857;
    static TerrainDemV1Client(token: string, options?: TileWebClientOptions): DemTileWebClient;
    static TerrainClientBathymetry(token: string, options?: TileWebClientOptions): TileWebClient<HTMLImageElement>;
    static TerrainClientCountry(token: string, options?: TileWebClientOptions): TileWebClient<HTMLImageElement>;
    static TerrainClientSatellite(token: string, options?: TileWebClientOptions): TileWebClient<HTMLImageElement>;
    static TerrainClientTerrain(token: string, options?: TileWebClientOptions): TileWebClient<HTMLImageElement>;
    static TerrainClientTerrainRGB(token: string, options?: TileWebClientOptions): TileWebClient<HTMLImageElement>;
    static TerrainClientTerrainV2(token: string, options?: TileWebClientOptions): TileWebClient<HTMLImageElement>;
    static TerrainClientTraffic(token: string, options?: TileWebClientOptions): TileWebClient<HTMLImageElement>;
}
