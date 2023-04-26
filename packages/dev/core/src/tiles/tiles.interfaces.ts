import { ICartesian2, IGeo3 } from "../geography/geography.interfaces";
import { Nullable } from "../types";

export function isTileAddress(b: unknown): b is ITileAddress {
    if (typeof b !== "object" || b === null) return false;
    return (<ITileAddress>b).x !== undefined && (<ITileAddress>b).y !== undefined && (<ITileAddress>b).levelOfDetail !== undefined;
}
export interface ITileAddress extends ICartesian2 {
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
    tileSize: number;
    minLOD: number;
    maxLOD: number;
    minLatitude: number;
    maxLatitude: number;
    minLongitude: number;
    maxLongitude: number;
    getLatLonToTileXY(latitude: number, longitude: number, levelOfDetail: number, tileXY?: ICartesian2): ICartesian2;
    getTileXYToLatLon(x: number, y: number, levelOfDetail: number, latLon?: IGeo3): IGeo3;
}

export interface ITileUrlFactory {
    buildUrl(request: ITileAddress, ...params: unknown[]): string;
}

export interface ITileCodec<T> {
    decode(r: void | Response): Promise<Nullable<Awaited<T>>>;
}

export interface ITileBuilder<T> {
    withData(data: T): ITileBuilder<T>;
    withAddress(address: ITileAddress): ITileBuilder<T>;
    build(): ITile<T>;
}

export interface ITileClientOptions<T> {
    urlFactory: ITileUrlFactory;
    codec: ITileCodec<T>;
}

export interface ITileClient<T, R extends ITileAddress> {
    options: ITileClientOptions<T>;
    fetchAsync(request: R): Promise<Nullable<Awaited<T>>>;
}

export interface IPixelDecoder {
    decode(pixels: Uint8ClampedArray, offset: number, target: Float32Array, targetOffset: number): number;
}
