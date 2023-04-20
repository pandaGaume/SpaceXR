import { ImageDecoderTileCodec } from "shelly/src/tiles/tiles.codecs.image";
import { IRgbValueDecoder, ITileAddress, ITileUrlFactory } from "shelly/src/tiles/tiles.interfaces";
import { WebTileUrlFactoryOptions } from "shelly/src/tiles/tiles.urlFactories";
import { TileClientOptions } from "shelly/src/tiles/tiles.client";
import { Tile } from "shelly/src/tiles/tiles.tile";
import { Ellipsoid } from "../geodesy/geodesy.ellipsoid";
export declare class DEMTile extends Tile<Float32Array> {
    static _PrepareLookupTable(fromDeg: number, toDeg: number, count: number, ellipsoid?: Ellipsoid): Float32Array;
    _normals?: Float32Array;
    _latLookupTable?: Float32Array;
    _lonLookupTable?: Float32Array;
    constructor(data: Float32Array, address?: ITileAddress);
    get normals(): Float32Array | undefined;
    set normals(n: Float32Array | undefined);
    get latitudeLookupTable(): Float32Array | undefined;
    set latitudeLookupTable(n: Float32Array | undefined);
    get longitudeLookupTable(): Float32Array | undefined;
    set longitudeLookupTable(n: Float32Array | undefined);
}
export declare class MapzenRgbValueDecoder implements IRgbValueDecoder<number> {
    static Shared: MapzenRgbValueDecoder;
    decode(pixels: Uint8ClampedArray, offset: number, size: number): number;
}
export declare class MapzenNormalValueDecoder implements IRgbValueDecoder<Array<number>> {
    static Shared: MapzenRgbValueDecoder;
    decode(pixels: Uint8ClampedArray, offset: number, size: number): Array<number>;
}
export declare class CommonRgbValueDecoder implements IRgbValueDecoder<number> {
    static Shared: CommonRgbValueDecoder;
    decode(pixels: Uint8ClampedArray, offset: number, size: number): number;
}
export declare class MapZenTerrainUrlFactoryOptions extends WebTileUrlFactoryOptions {
    _type: string;
    constructor(type: string, extension?: string);
}
export declare class DemTileClientOptions extends TileClientOptions<Float32Array> {
    static MapZenTerrarium: DemTileClientOptions;
    static MapZenNormal: DemTileClientOptions;
    constructor(urlFactory: ITileUrlFactory, codec: ImageDecoderTileCodec);
}
