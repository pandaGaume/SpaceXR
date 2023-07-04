import { DemTileWebClient } from "../../dem/dem.tileclient";
import { TileWebClientOptions } from "../tiles.client";
import { IPixelDecoder } from "../tiles.interfaces";
import { WebTileUrlBuilder } from "../tiles.urlBuilder";
export declare class MapBoxTerrainDemV1UrlBuilder extends WebTileUrlBuilder {
    constructor(token: string, extension?: string);
}
export declare class MapboxAltitudeDecoder implements IPixelDecoder {
    static Shared: MapboxAltitudeDecoder;
    decode(pixels: Uint8ClampedArray, offset: number, target: Float32Array, targetOffset: number): number;
}
export declare class MapBox {
    static MaxLevelOfDetail: number;
    static TerrainDemV1Client(token: string, options?: TileWebClientOptions): DemTileWebClient;
}
