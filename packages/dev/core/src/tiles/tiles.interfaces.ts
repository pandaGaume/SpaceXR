import { ICartesian2, IGeo2, IGeoBounded } from "../geography/geography.interfaces";
import { Nullable } from "../types";

export function isTileAddress(b: unknown): b is ITileAddress {
    if (typeof b !== "object" || b === null) return false;
    return (<ITileAddress>b).x !== undefined && (<ITileAddress>b).y !== undefined && (<ITileAddress>b).levelOfDetail !== undefined;
}
export interface ITileAddress extends ICartesian2 {
    levelOfDetail: number;
}

export interface ITile<T> extends IGeoBounded {
    address?: ITileAddress;
    data?: T;
}

export enum TileCellReference {
    center,
    upperleft,
}

export interface ITileMetricsOptions {
    tileSize?: number;
    minLOD?: number;
    maxLOD?: number;
    minLatitude?: number;
    maxLatitude?: number;
    minLongitude?: number;
    maxLongitude?: number;
    cellReference?: TileCellReference;
}

export interface ITileMetrics {
    tileSize: number;
    minLOD: number;
    maxLOD: number;
    minLatitude: number;
    maxLatitude: number;
    minLongitude: number;
    maxLongitude: number;
    cellReference?: TileCellReference;

    mapSize(levelOfDetail: number): number;
    mapScale(latitude: number, levelOfDetail: number, dpi: number): number;
    groundResolution(latitude: number, levelOfDetail: number): number;

    getLatLonToTileXY(latitude: number, longitude: number, levelOfDetail: number, tileXY?: ICartesian2): ICartesian2;
    getTileXYToLatLon(x: number, y: number, levelOfDetail: number, latLon?: IGeo2): IGeo2;
    getLatLonToPixelXY(latitude: number, longitude: number, levelOfDetail: number, pixelXY?: ICartesian2): ICartesian2;
    getPixelXYToLatLon(x: number, y: number, levelOfDetail: number, latLon?: IGeo2): IGeo2;
    getTileXYToPixelXY(x: number, y: number, levelOfDetail: number, pixelXY?: ICartesian2): ICartesian2;
    getPixelXYToTileXY(x: number, y: number, levelOfDetail: number, tileXY?: ICartesian2): ICartesian2;

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

export interface ITileDirectory<V, R extends ITileAddress, M extends ITileMetrics> {
    metrics: M;
    lookupAsync(x: number, y: number, levelOfDetail: number): Promise<Nullable<V> | Array<Nullable<V>> | undefined>;
}
