import { ILocation, ITileMetrics, ITileMetricsOptions, IVector2 } from "./tiles.interfaces";
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
    overlapMode?: TileOverlapMode;
}
export declare class TileMetricsOptionsBuilder {
    _tileSize?: number;
    _minLOD?: number;
    _maxLOD?: number;
    _minLatitude?: number;
    _maxLatitude?: number;
    _minLongitude?: number;
    _maxLongitude?: number;
    _overlapMode?: TileOverlapMode;
    withTileSize(v?: number): TileMetricsOptionsBuilder;
    withMinLOD(v?: number): TileMetricsOptionsBuilder;
    withMaxLOD(v?: number): TileMetricsOptionsBuilder;
    withMinLatitude(v?: number): TileMetricsOptionsBuilder;
    withMaxLatitude(v?: number): TileMetricsOptionsBuilder;
    withMinLongitude(v?: number): TileMetricsOptionsBuilder;
    withMaxLongitude(v?: number): TileMetricsOptionsBuilder;
    withTileOverlapMode(v?: TileOverlapMode): TileMetricsOptionsBuilder;
    build(): ITileMetricsOptions;
}
export declare class TileMetricsBase implements ITileMetrics {
    static Shared: TileMetricsBase;
    private static Clamp;
    _o: TileMetricsOptions;
    constructor(options?: Partial<TileMetricsOptions>);
    get options(): TileMetricsOptions;
    set options(value: Partial<TileMetricsOptions>);
    get tileSize(): number;
    set tileSize(s: number);
    getMapSize(levelOfDetail: number): number;
    getGroundResolution(latitude: number, levelOfDetail: number, radius: number): number;
    getMapScale(latitude: number, levelOfDetail: number, screenDpi: number, radius: number): number;
    getLatLonToPixelXY(latitude: number, longitude: number, levelOfDetail: number, pixel?: IVector2): IVector2;
    getLatLonToTileXY(latitude: number, longitude: number, levelOfDetail: number, tileXY?: IVector2): IVector2;
    getPixelXYToLatLon(x: number, y: number, levelOfDetail: number, pos?: ILocation): ILocation;
    getPixelXYToTileXY(x: number, y: number, tile?: IVector2): IVector2;
    getTileXYToPixelXY(x: number, y: number, pixel?: IVector2): IVector2;
    getTileXYToLatLon(x: number, y: number, levelOfDetail: number, pos?: ILocation): ILocation;
}
