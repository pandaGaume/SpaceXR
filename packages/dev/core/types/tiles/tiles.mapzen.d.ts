import { TileClientOptions } from "./tiles.client";
import { IPixelDecoder } from "./tiles.interfaces";
import { WebTileUrlBuilder } from "./tiles.urlBuilder";
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
export declare class MapZenTileClientOptions {
    static Terrarium: TileClientOptions<Float32Array>;
    static Normal: TileClientOptions<Float32Array>;
}
