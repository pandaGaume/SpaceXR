import { IGeo2, IGeoBounded } from "../geography/geography.interfaces";
import { ICartesian2 } from "../geometry/geometry.interfaces";

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

    mapSize(levelOfDetail: number): number;
    mapScale(latitude: number, levelOfDetail: number, dpi: number): number;
    groundResolution(latitude: number, levelOfDetail: number): number;

    getLatLonToTileXY(latitude: number, longitude: number, levelOfDetail: number, tileXY?: ICartesian2): ICartesian2;
    getTileXYToLatLon(x: number, y: number, levelOfDetail: number, latLon?: IGeo2): IGeo2;
    getLatLonToPixelXY(latitude: number, longitude: number, levelOfDetail: number, pixelXY?: ICartesian2): ICartesian2;
    getPixelXYToLatLon(x: number, y: number, levelOfDetail: number, latLon?: IGeo2): IGeo2;
    getTileXYToPixelXY(x: number, y: number, levelOfDetail: number, pixelXY?: ICartesian2): ICartesian2;
    getPixelXYToTileXY(x: number, y: number, levelOfDetail: number, tileXY?: ICartesian2): ICartesian2;

    assertValidAddress(a: ITileAddress): void;
    isValidAddress(a: ITileAddress): boolean;
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

export type LookupData<V> = V | undefined;

export class TileDirectoryResult<V> implements ITileAddress {
    x: number;
    y: number;
    levelOfDetail: number;

    public constructor(a: ITileAddress, public data: LookupData<V>, public args: unknown) {
        this.x = a.x;
        this.y = a.y;
        this.levelOfDetail = a.levelOfDetail;
    }
}

export interface ITileDirectory<V> {
    metrics: ITileMetrics;
    lookupAsync(address: ITileAddress, args?: unknown): Promise<TileDirectoryResult<V>>;
}
