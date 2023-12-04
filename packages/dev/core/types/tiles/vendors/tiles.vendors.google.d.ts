import { TileWebClient, TileWebClientOptions } from "../tiles.client";
import { EPSG3857 } from "../tiles.geography";
import { WebTileUrlBuilder } from "../tiles.urlBuilder";
export declare enum GoogleMap2DLayerCode {
    street = "m",
    satellite = "s",
    hybrid = "h",
    terrain = "p",
    roadmap = "r",
    aerial = "y",
    height = "t"
}
export declare class GoogleMap2DUrlBuilder extends WebTileUrlBuilder {
    static Street: GoogleMap2DUrlBuilder;
    static Satellite: GoogleMap2DUrlBuilder;
    static Hybrid: GoogleMap2DUrlBuilder;
    static Terrain: GoogleMap2DUrlBuilder;
    static Roadmap: GoogleMap2DUrlBuilder;
    static Aerial: GoogleMap2DUrlBuilder;
    static Height: GoogleMap2DUrlBuilder;
    constructor(...types: (GoogleMap2DLayerCode | string)[]);
}
export declare class Google {
    private static readonly KEY;
    static MaxLevelOfDetail: number;
    static MetricsOptions: import("..").ITileMetricsOptions;
    static Metrics: EPSG3857;
    static Client2d(urlBuilder: GoogleMap2DUrlBuilder, options?: TileWebClientOptions): TileWebClient<HTMLImageElement>;
    static StreetClient2d(options?: TileWebClientOptions): TileWebClient<HTMLImageElement>;
    static SatelliteClient2d(options?: TileWebClientOptions): TileWebClient<HTMLImageElement>;
    static HybridClient2d(options?: TileWebClientOptions): TileWebClient<HTMLImageElement>;
    static TerrainClient2d(options?: TileWebClientOptions): TileWebClient<HTMLImageElement>;
    static RoadmapClient2d(options?: TileWebClientOptions): TileWebClient<HTMLImageElement>;
    static AerialClient2d(options?: TileWebClientOptions): TileWebClient<HTMLImageElement>;
    static HeightClient2d(options?: TileWebClientOptions): TileWebClient<HTMLImageElement>;
}
