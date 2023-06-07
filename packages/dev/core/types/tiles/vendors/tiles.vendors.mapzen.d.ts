import { TileWebClient, TileWebClientOptions } from "../tiles.client";
import { IPixelDecoder } from "../tiles.interfaces";
import { WebTileUrlBuilder } from "../tiles.urlBuilder";
import { EPSG3857 } from "../tiles.geography";
import { DemTileWebClient } from "../../dem/dem.tileclient";
export declare class MapZenDemUrlBuilder extends WebTileUrlBuilder {
    static Terrarium: MapZenDemUrlBuilder;
    static Normal: MapZenDemUrlBuilder;
    constructor(format: string, extension?: string);
}
export declare class MapzenAltitudeDecoder implements IPixelDecoder {
    static Shared: MapzenAltitudeDecoder;
    decode(pixels: Uint8ClampedArray, offset: number, target: Float32Array, targetOffset: number): number;
}
export declare class MapzenNormalValueDecoder implements IPixelDecoder {
    static Shared: MapzenNormalValueDecoder;
    decode(pixels: Uint8ClampedArray, offset: number, target: Float32Array, targetOffset: number): number;
}
export declare class MapZen {
    static MaxLevelOfDetail: number;
    static MetricsOptions: import("../tiles.interfaces").ITileMetricsOptions;
    static Metrics: EPSG3857;
    static ElevationsImagesClient(options?: TileWebClientOptions): TileWebClient<HTMLImageElement>;
    static ElevationsClient(options?: TileWebClientOptions): TileWebClient<Float32Array>;
    static NormalsImagesClient(options?: TileWebClientOptions): TileWebClient<HTMLImageElement>;
    static NormalsClient(options?: TileWebClientOptions): TileWebClient<Float32Array>;
    static DemClient(optionsElevations?: TileWebClientOptions, optionsNormals?: TileWebClientOptions): DemTileWebClient;
}
