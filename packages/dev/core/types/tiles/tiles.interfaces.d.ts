import { Nullable } from "../types";
import { IGeo2, IGeoBounded } from "../geography/geography.interfaces";
import { ICartesian2, ICartesian3, IRectangle, ISize2 } from "../geometry/geometry.interfaces";
export declare function isTileAddress(b: unknown): b is ITileAddress;
export interface ITileAddress extends ICartesian2 {
    levelOfDetail: number;
    quadkey: string;
}
export interface ITileSection extends ICartesian2, ISize2 {
}
export interface ITileContentView<T> {
    address: ITileAddress;
    source?: ICartesian3;
    target?: ICartesian3;
    delegate: T;
}
export interface ITileCruncher<T> {
    Downsampling(childs: T[]): Nullable<T>;
    Upsampling(parent: T, sectionIndex: number): Nullable<T>;
}
export declare function IsTileContentView<T>(b: unknown): b is ITileContentView<T>;
export type TileContent<T> = Nullable<Array<Nullable<T | ITileContentView<T>>>>;
export interface ITile<T> extends IGeoBounded {
    address: ITileAddress;
    content: TileContent<T>;
    rect?: IRectangle;
    key: string;
    neighborKeys?: string;
}
export interface ITileProxy<T> {
    delegate: ITile<T>;
}
export interface ITileBuilder<T> {
    withAddress(a: ITileAddress): ITileBuilder<T>;
    withData(d: TileContent<T>): ITileBuilder<T>;
    withMetrics(metrics: ITileMetrics): ITileBuilder<T>;
    build(): ITile<T>;
}
export declare enum CellCoordinateReference {
    center = "center",
    nw = "nw",
    ne = "ne",
    sw = "sw",
    se = "se"
}
export interface ITileMetricsOptions {
    minLOD?: number;
    maxLOD?: number;
    minLatitude?: number;
    maxLatitude?: number;
    minLongitude?: number;
    maxLongitude?: number;
    tileSize?: number;
    cellSize?: number;
    cellCoordinateReference?: CellCoordinateReference;
    overlap?: number;
}
export interface ITileMetrics {
    minLOD: number;
    maxLOD: number;
    minLatitude: number;
    maxLatitude: number;
    minLongitude: number;
    maxLongitude: number;
    tileSize: number;
    cellSize: number;
    cellCoordinateReference: CellCoordinateReference;
    overlap: number;
    mapSize(levelOfDetail: number): number;
    mapScale(latitude: number, levelOfDetail: number, dpi: number): number;
    groundResolution(latitude: number, levelOfDetail: number): number;
    getLatLonToTileXY(latitude: number, longitude: number, levelOfDetail: number, tileXY?: ICartesian2): ICartesian2;
    getTileXYToLatLon(x: number, y: number, levelOfDetail: number, latLon?: IGeo2): IGeo2;
    getLatLonToPixelXY(latitude: number, longitude: number, levelOfDetail: number, pixelXY?: ICartesian2): ICartesian2;
    getPixelXYToLatLon(x: number, y: number, levelOfDetail: number, latLon?: IGeo2): IGeo2;
    getTileXYToPixelXY(x: number, y: number, pixelXY?: ICartesian2): ICartesian2;
    getPixelXYToTileXY(x: number, y: number, tileXY?: ICartesian2): ICartesian2;
    assertValidAddress(a: ITileAddress): void;
    isValidAddress(a: ITileAddress): boolean;
}
export interface ITileMetricsProvider {
    metrics: ITileMetrics;
}
export declare class FetchResult<T> {
    address: ITileAddress;
    content: T;
    userArgs: Array<unknown>;
    status?: number;
    statusText?: string;
    constructor(address: ITileAddress, content: T, userArgs: Array<unknown>);
}
export interface ITileDatasource<T, R extends ITileAddress> extends ITileMetricsProvider {
    fetchAsync(request: R, ...userArgs: Array<unknown>): Promise<FetchResult<Nullable<T>>>;
}
export interface ITileUrlBuilder {
    buildUrl(address: ITileAddress, ...params: unknown[]): string;
}
export interface ITileCodec<T> {
    decodeAsync(r: void | Response): Promise<Nullable<T>>;
}
export interface ITileClient<T> extends ITileDatasource<T, ITileAddress> {
}
export interface IPixelDecoder {
    decode(pixels: Uint8ClampedArray, offset: number, target: Float32Array, targetOffset: number): number;
}
export interface ITileMapApi {
    invalidateSize(w: number, h: number): ITileMapApi;
    setView(center: IGeo2, zoom?: number, rotation?: number): ITileMapApi;
    setZoom(zoom: number): ITileMapApi;
    setAzimuth(r: number): ITileMapApi;
    zoomIn(delta: number): ITileMapApi;
    zoomOut(delta: number): ITileMapApi;
    translate(tx: number, ty: number): ITileMapApi;
    rotate(r: number): ITileMapApi;
}
export interface ITileMapLayerApi<T> {
    addLayer(key: string, source: ITileClient<T>): ITileMapLayerApi<T>;
    removeLayer(key: string): ITileMapLayerApi<T>;
    setMainLayer(key: string): ITileMapLayerApi<T>;
}
