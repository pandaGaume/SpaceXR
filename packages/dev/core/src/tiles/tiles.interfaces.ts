import { Nullable } from "../types";
import { IGeo2, IGeoBounded } from "../geography/geography.interfaces";
import { ICartesian2, ICartesian3, IRectangle } from "../geometry/geometry.interfaces";

export function isTileAddress(b: unknown): b is ITileAddress {
    if (typeof b !== "object" || b === null) return false;
    return (<ITileAddress>b).x !== undefined && (<ITileAddress>b).y !== undefined && (<ITileAddress>b).levelOfDetail !== undefined;
}

export interface ITileAddress extends ICartesian2 {
    levelOfDetail: number;
    quadkey: string;
}

export type TileSection = Nullable<ICartesian3 | Nullable<ICartesian3>[]>;

export interface ITileContentView {
    address: ITileAddress;
    source?: TileSection;
    target?: TileSection;
}

export interface ITileCruncher<T> {
    Downsampling(childs: T[]): Nullable<T>;
    Upsampling(parent: T, sectionIndex: number): Nullable<T>;
}

export function IsTileContentView<T>(b: unknown): b is ITileContentView {
    if (typeof b !== "object" || b === null) return false;
    return (<any>b).source !== undefined && (<any>b).target !== undefined;
}

export type TileContent<T> = Nullable<T | ITileContentView>;

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

export enum CellCoordinateReference {
    center = "center",
    nw = "nw",
    ne = "ne",
    sw = "sw",
    se = "se",
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
    lodCount: number;
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
    clampLevelOfDetail(levelOfDetail: number): number;
}

export interface ITileMetricsProvider {
    metrics: ITileMetrics;
}

export class FetchResult<T> {
    status?: number;
    statusText?: string;
    public constructor(public address: ITileAddress, public content: T, public userArgs: Array<unknown>) {}
}

export interface ITileDatasource<T, R extends ITileAddress> extends ITileMetricsProvider {
    name: string;
    fetchAsync(request: R, ...userArgs: Array<unknown>): Promise<FetchResult<Nullable<T>>>;
}

export interface ITileUrlBuilder {
    buildUrl(address: ITileAddress, ...params: unknown[]): string;
}

export interface ITileCodec<T> {
    decodeAsync(r: void | Response): Promise<Nullable<T>>;
}

export interface ITileClient<T> extends ITileDatasource<T, ITileAddress> {}

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
