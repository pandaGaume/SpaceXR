import { TileWebClient } from "../tiles.client";
import { WebTileUrlBuilder } from "../tiles.url.web";
import { EPSG3857 } from "../geography/tiles.geography.EPSG3857";
import { DemTileWebClient } from "../../dem/dem.tileclient";
import { IPixelDecoder } from "../codecs/tiles.codecs.interfaces";
import { ICartesian4 } from "../../geometry";
import { WebClientOptions } from "../../io";
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
    static ElevationsImagesClient(options?: WebClientOptions): TileWebClient<HTMLImageElement>;
    static ElevationsClient(options?: WebClientOptions): TileWebClient<Float32Array<ArrayBufferLike>>;
    static NormalsImagesClient(options?: WebClientOptions): TileWebClient<HTMLImageElement>;
    static NormalsUint8ArrayClient(options?: WebClientOptions): TileWebClient<Uint8ClampedArray<ArrayBufferLike>>;
    static NormalsCartesian4Client(options?: WebClientOptions): TileWebClient<ICartesian4[]>;
    static DemClient(optionsElevations?: WebClientOptions, optionsNormals?: WebClientOptions): DemTileWebClient;
}
