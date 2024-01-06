import { TileWebClient, TileWebClientOptions } from "../tiles.client";
import { WebTileUrlBuilder } from "../tiles.urlBuilder";
import { EPSG3857 } from "../geography/tiles.geography.EPSG3857";
import { DemTileWebClient } from "../../dem/dem.tileclient";
import { IPixelDecoder } from "../codecs/tiles.codecs.interfaces";
export declare class MapZenDemUrlBuilder extends WebTileUrlBuilder {
    static Terrarium: MapZenDemUrlBuilder;
    static Normal: MapZenDemUrlBuilder;
    constructor(format: string, extension?: string);
}
export declare class MapzenAltitudeDecoder implements IPixelDecoder {
    static Shared: MapzenAltitudeDecoder;
    decode(pixels: Uint8ClampedArray, offset: number, target: Float32Array, targetOffset: number): number;
}
export declare class MapZen {
    private static readonly KEY;
    static MaxLevelOfDetail: number;
    static Metrics: EPSG3857;
    static ElevationsImagesClient(options?: TileWebClientOptions): TileWebClient<HTMLImageElement>;
    static ElevationsClient(options?: TileWebClientOptions): TileWebClient<Float32Array>;
    static NormalsImagesClient(options?: TileWebClientOptions): TileWebClient<HTMLImageElement>;
    static NormalsClient(options?: TileWebClientOptions): TileWebClient<Uint8ClampedArray>;
    static DemClient(optionsElevations?: TileWebClientOptions, optionsNormals?: TileWebClientOptions): DemTileWebClient;
}
