import { TileWebClient, TileWebClientOptions } from "../tiles.client";
import { WebTileUrlBuilder } from "../tiles.urlBuilder";
import { EPSG3857 } from "../geography/tiles.geography.EPSG3857";
import { DemTileWebClient } from "../../dem/dem.tileclient";
import { IPixelDecoder } from "../codecs/tiles.codecs.interfaces";
import { ICartesian4 } from "../../geometry";
export declare class MapZenDemUrlBuilder extends WebTileUrlBuilder {
    static Terrarium: MapZenDemUrlBuilder;
    static Normal: MapZenDemUrlBuilder;
    constructor(format: string, extension?: string);
}
export declare class MapzenAltitudeDecoder implements IPixelDecoder<Float32Array> {
    static Shared: MapzenAltitudeDecoder;
    decode(pixels: Uint8ClampedArray, offset: number, target: Float32Array, targetOffset: number): number;
}
export declare class MapZenNormalsDecoder implements IPixelDecoder<Array<ICartesian4>> {
    static Shared: MapZenNormalsDecoder;
    decode(pixels: Uint8ClampedArray, offset: number, target: Array<ICartesian4>, targetOffset: number): number;
}
export declare class MapZen {
    private static readonly KEY;
    static MaxLevelOfDetail: number;
    static Metrics: EPSG3857;
    static Attribution: string;
    static ElevationsImagesClient(options?: TileWebClientOptions): TileWebClient<HTMLImageElement>;
    static ElevationsClient(options?: TileWebClientOptions): TileWebClient<Float32Array>;
    static NormalsImagesClient(options?: TileWebClientOptions): TileWebClient<HTMLImageElement>;
    static NormalsUint8ArrayClient(options?: TileWebClientOptions): TileWebClient<ImageData>;
    static NormalsCartesian4Client(options?: TileWebClientOptions): TileWebClient<ICartesian4[]>;
    static DemClient(optionsElevations?: TileWebClientOptions, optionsNormals?: TileWebClientOptions): DemTileWebClient;
}
