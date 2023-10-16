import { DemTileWebClient } from "../../dem/dem.tileclient";
import { TileWebClient, TileWebClientOptions } from "../tiles.client";
import { EPSG3857 } from "../tiles.geography";
import { IPixelDecoder } from "../tiles.interfaces";
import { WebTileUrlBuilder } from "../tiles.urlBuilder";
export declare class MapBoxTerrainDemV1UrlBuilder extends WebTileUrlBuilder {
    constructor(token: string, extension?: string);
}
export declare class MapBoxStaticTilesUrlBuilder extends WebTileUrlBuilder {
    constructor(username: string, styleId: string, token: string, tileSize?: number);
}
export declare class MapboxAltitudeDecoder implements IPixelDecoder {
    static Shared: MapboxAltitudeDecoder;
    decode(pixels: Uint8ClampedArray, offset: number, target: Float32Array, targetOffset: number): number;
}
export declare class MapBox {
    static MaxLevelOfDetail: number;
    static MetricsOptions: import("../tiles.interfaces").ITileMetricsOptions;
    static Metrics: EPSG3857;
    static TerrainDemV1Client(token: string, options?: TileWebClientOptions): DemTileWebClient;
    private static StaticTilesClient2d;
    static BlueMonoClient(options?: TileWebClientOptions): TileWebClient<HTMLImageElement>;
    static VintageClient(options?: TileWebClientOptions): TileWebClient<HTMLImageElement>;
    static HillShadingClient(options?: TileWebClientOptions): TileWebClient<HTMLImageElement>;
}
