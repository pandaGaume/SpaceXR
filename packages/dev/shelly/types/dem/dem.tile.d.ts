import { TileClientOptions, WebTileUrlFactoryOptions } from "../tiles";
import { ImageDecoderTileCodec } from "../tiles/tiles.codecs.image";
import { IRgbValueDecoder, ITileUrlFactory } from "../tiles/tiles.interfaces";
import { FloatArray } from "../types";
export declare class MapzenRgbValueDecoder implements IRgbValueDecoder {
    static Shared: MapzenRgbValueDecoder;
    decode(pixels: Uint8ClampedArray, offset: number, size: number): number;
}
export declare class CommonRgbValueDecoder implements IRgbValueDecoder {
    static Shared: CommonRgbValueDecoder;
    decode(pixels: Uint8ClampedArray, offset: number, size: number): number;
}
export declare class MapZenTerrainUrlFactoryOptions extends WebTileUrlFactoryOptions {
    _type: string;
    constructor(type: string, extension?: string);
}
export declare class DemTileClientOptions extends TileClientOptions<FloatArray> {
    static MapZenTerrarium: DemTileClientOptions;
    static MapZenNormal: DemTileClientOptions;
    constructor(urlFactory: ITileUrlFactory, codec: ImageDecoderTileCodec);
}
