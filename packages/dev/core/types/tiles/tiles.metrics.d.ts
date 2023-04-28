import { ICartesian2, IGeo3 } from "../geography/geography.interfaces";
import { ITileAddress, ITileMetrics, ITileMetricsOptions } from "./tiles.interfaces";
export declare enum TileOverlapMode {
    ON = 0,
    OFF = 1
}
export declare class TileMetricsOptions implements ITileMetricsOptions {
    static DefaultTileSize: number;
    static DefaultMinLOD: number;
    static DefaultMaxLOD: number;
    static DefaultMinLatitude: number;
    static DefaultMaxLatitude: number;
    static DefaultMinLongitude: number;
    static DefaultMaxLongitude: number;
    static DefaultOverlapMode: TileOverlapMode;
    static Shared: TileMetricsOptions;
    tileSize?: number;
    minLOD?: number;
    maxLOD?: number;
    minLatitude?: number;
    maxLatitude?: number;
    minLongitude?: number;
    maxLongitude?: number;
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
export declare abstract class AbstractTileMetrics implements ITileMetrics {
    static TileXYToQuadKey(tileX: number, tileY: number, levelOfDetail: number): Uint8Array;
    static QuadKeyToTileXY(quadKey: Uint8Array, from?: number): ITileAddress;
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
    abstract getLatLonToTileXY(latitude: number, longitude: number, levelOfDetail: number, tileXY?: ICartesian2 | undefined): ICartesian2;
    abstract getTileXYToLatLon(x: number, y: number, levelOfDetail: number, latLon?: IGeo3 | undefined): IGeo3;
}
