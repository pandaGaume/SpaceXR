import { TileClientOptions } from "shelly/src/tiles/tiles.client";
import { IPixelDecoder } from "shelly/src/tiles/tiles.interfaces";
import { WebTileUrlFactoryOptions } from "shelly/src/tiles/tiles.urlFactories";
export declare class MapZenTerrainUrlFactoryOptions extends WebTileUrlFactoryOptions {
    _type: string;
    constructor(type: string, extension?: string);
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
