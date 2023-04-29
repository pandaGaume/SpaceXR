import { ICartesian2, IGeo3 } from "../geography/geography.interfaces";
import { ITileAddress, ITileMetrics, ITileMetricsOptions, ITileMapMetrics } from "./tiles.interfaces";
export declare enum TileOverlapMode {
    ON = 0,
    OFF = 1
}
export declare class TileMetricsOptions implements ITileMetricsOptions {
    tileSize: number;
    minLOD: number;
    maxLOD: number;
    minLatitude: number;
    maxLatitude: number;
    minLongitude: number;
    maxLongitude: number;
    static DefaultTileSize: number;
    static DefaultLOD: number;
    static DefaultMinLOD: number;
    static DefaultMaxLOD: number;
    static DefaultMinLatitude: number;
    static DefaultMaxLatitude: number;
    static DefaultMinLongitude: number;
    static DefaultMaxLongitude: number;
    static DefaultOverlapMode: TileOverlapMode;
    static Shared: TileMetricsOptions;
    constructor(tileSize: number, minLOD: number, maxLOD: number, minLatitude: number, maxLatitude: number, minLongitude: number, maxLongitude: number);
}
export declare class TileMetricsOptionsBuilder {
    _tileSize?: number;
    _minLOD?: number;
    _maxLOD?: number;
    _minLatitude?: number;
    _maxLatitude?: number;
    _minLongitude?: number;
    _maxLongitude?: number;
    withTileSize(v?: number): TileMetricsOptionsBuilder;
    withMinLOD(v?: number): TileMetricsOptionsBuilder;
    withMaxLOD(v?: number): TileMetricsOptionsBuilder;
    withMinLatitude(v?: number): TileMetricsOptionsBuilder;
    withMaxLatitude(v?: number): TileMetricsOptionsBuilder;
    withMinLongitude(v?: number): TileMetricsOptionsBuilder;
    withMaxLongitude(v?: number): TileMetricsOptionsBuilder;
    build(): ITileMetricsOptions;
}
export declare class TileMetrics {
    static TileXYToQuadKey(tileX: number, tileY: number, levelOfDetail: number): Uint8Array;
    static QuadKeyToTileXY(quadKey: Uint8Array): ITileAddress;
}
export declare abstract class AbstractTileMetrics implements ITileMetrics {
    _o: TileMetricsOptions;
    constructor(options?: Partial<TileMetricsOptions>);
    get options(): TileMetricsOptions;
    get tileSize(): number;
    get minLOD(): number;
    get maxLOD(): number;
    get minLatitude(): number;
    get maxLatitude(): number;
    get minLongitude(): number;
    get maxLongitude(): number;
    assertValidAddress(x: number, y: number, levelOfDetail: number): void;
    abstract getLatLonToTileXY(latitude: number, longitude: number, levelOfDetail: number, tileXY?: ICartesian2 | undefined): ICartesian2;
    abstract getTileXYToLatLon(x: number, y: number, levelOfDetail: number, latLon?: IGeo3 | undefined): IGeo3;
}
export declare abstract class AbstractTileMapMetrics extends AbstractTileMetrics implements ITileMapMetrics {
    abstract getLatLonToPixelXY(latitude: number, longitude: number, levelOfDetail: number, pixelXY?: ICartesian2): ICartesian2;
    abstract getPixelXYToLatLon(x: number, y: number, levelOfDetail: number, latLon?: IGeo3): IGeo3;
    abstract getTileXYToPixelXY(x: number, y: number, levelOfDetail: number, pixelXY?: ICartesian2): ICartesian2;
    abstract getPixelXYToTileXY(x: number, y: number, levelOfDetail: number, tileXY?: ICartesian2): IGeo3;
}
