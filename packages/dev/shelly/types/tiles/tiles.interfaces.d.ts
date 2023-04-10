import { FloatArray, Nullable } from "../types";
export interface IVector2 {
    x: number;
    y: number;
}
export interface ILocation {
    lat: number;
    lon: number;
    alt: number;
}
export interface ITileAddress extends IVector2 {
    levelOfDetail: number;
}
export interface ITile<T> {
    address?: ITileAddress;
    data: T;
}
export interface ITileMetricsOptions {
    tileSize?: number;
    minLOD?: number;
    maxLOD?: number;
    minLatitude?: number;
    maxLatitude?: number;
    minLongitude?: number;
    maxLongitude?: number;
}
export interface ITileMetrics {
    options: ITileMetricsOptions;
    getMapSize(levelOfDetail: number): number;
    getGroundResolution(latitude: number, levelOfDetail: number, semiMajor: number): number;
    getMapScale(latitude: number, levelOfDetail: number, screenDpi: number, semiMajor: number): number;
    getLatLonToPixelXY(latitude: number, longitude: number, levelOfDetail: number, pixelXY?: IVector2): IVector2;
    getLatLonToTileXY(latitude: number, longitude: number, levelOfDetail: number, tileXY?: IVector2): IVector2;
    getPixelXYToTileXY(x: number, y: number, tileXY?: IVector2): IVector2;
    getPixelXYToLatLon(x: number, y: number, levelOfDetail: number, latLon?: ILocation): ILocation;
    getTileXYToPixelXY(x: number, y: number, pixelXY?: IVector2): IVector2;
    getTileXYToLatLon(x: number, y: number, levelOfDetail: number, latLon?: ILocation): ILocation;
}
export interface ITileUrlFactory {
    buildUrl(request: ITileAddress, ...params: unknown[]): string;
}
export interface ITileCodec<T> {
    decode(r: void | Response): Promise<Nullable<Awaited<ITile<T>>>>;
}
export interface ITileClientOptions<T> {
    urlFactory: ITileUrlFactory;
    codec: ITileCodec<T>;
}
export interface ITileClient<T, R extends ITileAddress> {
    options: ITileClientOptions<T>;
    fetchAsync(request: R): Promise<Nullable<Awaited<ITile<T>>>>;
}
export interface IFloatTileMetrics {
    min: number;
    max: number;
    mean?: number;
}
export interface IFloatTile extends ITile<FloatArray> {
    metrics: IFloatTileMetrics;
}
export interface IRgbValueDecoder {
    decode(pixels: Uint8ClampedArray, offset: number, size: number): number;
}
