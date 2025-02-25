import { TileWebClient } from "../tiles.client";
import { EPSG3857 } from "../geography/tiles.geography.EPSG3857";
import { WebTileUrlBuilder } from "../tiles.url.web";
import { WebClientOptions } from "../../io";
export declare enum GoogleMap2DLayerCode {
    street = "m",
    satellite = "s",
    hybrid = "h",
    terrain = "p"
}
export declare class GoogleMap2DUrlBuilder extends WebTileUrlBuilder {
    static Street: GoogleMap2DUrlBuilder;
    static Satellite: GoogleMap2DUrlBuilder;
    static Hybrid: GoogleMap2DUrlBuilder;
    static Terrain: GoogleMap2DUrlBuilder;
    constructor(...types: (GoogleMap2DLayerCode | string)[]);
}
export declare class Google {
    private static readonly KEY;
    static MaxLevelOfDetail: number;
    static Metrics: EPSG3857;
    static Attribution: string;
    static Client2d(urlBuilder: GoogleMap2DUrlBuilder, options?: WebClientOptions): TileWebClient<HTMLImageElement>;
    static StreetClient2d(options?: WebClientOptions): TileWebClient<HTMLImageElement>;
    static SatelliteClient2d(options?: WebClientOptions): TileWebClient<HTMLImageElement>;
    static HybridClient2d(options?: WebClientOptions): TileWebClient<HTMLImageElement>;
    static TerrainClient2d(options?: WebClientOptions): TileWebClient<HTMLImageElement>;
}
