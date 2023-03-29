import { ILocation, ITileMetrics, ITileMetricsOptions, IVector2 } from "./tiles.interfaces";
export declare class TileMetricsOptions implements ITileMetricsOptions {
    static DefaultTileSize: 256;
    static DefaultMinLOD: 0;
    static DefaultMaxLOD: 23;
    static DefaultMinLatitude: -85.05112878;
    static DefaultMaxLatitude: 85.05112878;
    static DefaultMinLongitude: -180;
    static DefaultMaxLongitude: 180;
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
export declare class TileMetricsBase implements ITileMetrics {
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
