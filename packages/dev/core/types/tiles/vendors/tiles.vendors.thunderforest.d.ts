import { TileWebClient, TileWebClientOptions } from "../tiles.client";
import { EPSG3857 } from "../tiles.geography";
import { WebTileUrlBuilder } from "../tiles.urlBuilder";
export declare class ThunderForestStaticTilesUrlBuilder extends WebTileUrlBuilder {
    constructor(styleId: string, token: string);
}
export declare class ThunderForest {
    static MaxLevelOfDetail: number;
    static MetricsOptions: import("..").ITileMetricsOptions;
    static Metrics: EPSG3857;
    private static Client2d;
    static Spinal(options?: TileWebClientOptions): TileWebClient<HTMLImageElement>;
}
