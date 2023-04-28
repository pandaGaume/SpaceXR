import { ICartesian2, IGeo3, IGeoBounded } from "../geography/geography.interfaces";
import { Nullable } from "../types";
export declare function isTileAddress(b: unknown): b is ITileAddress;
export interface ITileAddress extends ICartesian2 {
    levelOfDetail: number;
}
export interface ITile<T> extends IGeoBounded {
    address?: ITileAddress;
    data?: T;
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
    tileSize: number;
    minLOD: number;
    maxLOD: number;
    minLatitude: number;
    maxLatitude: number;
    minLongitude: number;
    maxLongitude: number;
    getLatLonToTileXY(latitude: number, longitude: number, levelOfDetail: number, tileXY?: ICartesian2): ICartesian2;
    getTileXYToLatLon(x: number, y: number, levelOfDetail: number, latLon?: IGeo3): IGeo3;
    assertValidAddress(x: number, y: number, levelOfDetail: number): void;
}
export interface ITileMetricsProvider {
    metrics: ITileMetrics;
}
export interface ITileUrlBuilder {
    buildUrl(x: number, y: number, levelOfDetail: number, ...params: unknown[]): string;
}
export interface ITileCodec<T> {
    decodeAsync(r: void | Response): Promise<Awaited<T> | undefined>;
}
export interface ITileDatasource<T, R extends ITileAddress> {
    fetchAsync(request: R): Promise<T | undefined>;
}
export interface ITileClientOptions<T> {
    urlFactory: ITileUrlBuilder;
    codec: ITileCodec<T>;
}
export interface ITileClient<T, R extends ITileAddress> extends ITileDatasource<T, R> {
    options: ITileClientOptions<T>;
}
export interface IPixelDecoder {
    decode(pixels: Uint8ClampedArray, offset: number, target: Float32Array, targetOffset: number): number;
}
export interface ITileDirectory<V, R extends ITileAddress> {
    metrics: ITileMetrics;
    lookupAsync(x: number, y: number, levelOfDetail: number): Promise<Nullable<V> | Array<Nullable<V>> | undefined>;
}
