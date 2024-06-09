import { DemTileWebClient } from "../../dem/dem.tileclient";
import { TileWebClientOptions } from "../tiles.client";
import { WebTileUrlBuilder } from "../tiles.urlBuilder";
import { IPixelDecoder } from "../codecs/tiles.codecs.interfaces";
export declare class MapBoxTerrainDemV1UrlBuilder extends WebTileUrlBuilder {
    constructor(token: string, extension?: string);
}
export declare class MapboxAltitudeDecoder implements IPixelDecoder<Float32Array> {
    static Shared: MapboxAltitudeDecoder;
    decode(pixels: Uint8ClampedArray, offset: number, target: Float32Array, targetOffset: number): number;
}
export declare class MapBox {
    private static readonly KEY;
    static MaxLevelOfDetail: number;
    static TerrainDemV1Client(token: string, options?: TileWebClientOptions): DemTileWebClient;
}
