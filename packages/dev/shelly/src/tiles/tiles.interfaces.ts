import { Nullable } from "../types";

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
    tileSize: number;
    minLOD: number;
    maxLOD: number;
    minLatitude: number;
    maxLatitude: number;
    minLongitude: number;
    maxLongitude: number;
    getLatLonToTileXY(latitude: number, longitude: number, levelOfDetail: number, tileXY?: IVector2): IVector2;
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

export interface IFloatTile extends ITile<Float32Array> {
    metrics: IFloatTileMetrics;
}

export interface IRgbValueDecoder<T> {
    decode(pixels: Uint8ClampedArray, offset: number, size: number): T;
}
