import { Nullable } from "../types";
import { IGeo2, IGeoBounded } from "../geography/geography.interfaces";
import { ICartesian2, IRectangle, ISize2 } from "../geometry/geometry.interfaces";

export function isTileAddress(b: unknown): b is ITileAddress {
    if (typeof b !== "object" || b === null) return false;
    return (<ITileAddress>b).x !== undefined && (<ITileAddress>b).y !== undefined && (<ITileAddress>b).levelOfDetail !== undefined;
}

export interface ITileAddress extends ICartesian2 {
    levelOfDetail: number;
    quadkey: string;
}

/// <summary>
/// The TileAddressProcessor is versatile in its capabilities, primarily filtering and modifying addresses.
/// Not only to support increased zoom levels in layered Digital Elevation Model (DEM) applications,
/// but also adaptable for various other use cases.
/// </summary>
export interface ITileAddressProcessor {
    process(address: ITileAddress, metrics?: ITileMetrics): ITileAddress[] | ITileSection;
}

export interface ITileSection extends ICartesian2, ISize2 {
    address: ITileAddress;
}

export function IsTileSection(b: unknown): b is ITileSection {
    if (b === null || typeof b !== "object") return false;
    return (<ITileSection>b).address !== undefined && (<ITileSection>b).width !== undefined && (<ITileSection>b).height !== undefined;
}

export interface ITileCruncher<T> {
    Downsampling(childs: T[]): Nullable<T>;
    Upsampling(parent: T, sectionIndex: number): Nullable<T>;
}

export function IsTileContentView<T>(b: unknown): b is ITileSection {
    if (typeof b !== "object" || b === null) return false;
    return (<any>b).source !== undefined && (<any>b).target !== undefined;
}

export type TileContent<T> = Nullable<T | ITileSection>;

export interface ITile<T> extends IGeoBounded {
    namespace?: string;
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
    withNamespace(namesapce: string): ITileBuilder<T>;
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
}

export interface ITileMetricsProvider {
    metrics: ITileMetrics;
}

export class FetchResult<T> {
    public static Null<T>(address: ITileAddress, userArgs: Nullable<Array<unknown>>): FetchResult<Nullable<T>> {
        return new FetchResult<Nullable<T>>(address, null, userArgs);
    }

    status?: number;
    statusText?: string;
    public constructor(public address: ITileAddress, public content: T, public userArgs: Nullable<Array<unknown>> = null) {}
}

export interface ITileDatasource<T, A extends ITileAddress> extends ITileMetricsProvider {
    name: string;
    fetchAsync(address: A, ...userArgs: Array<unknown>): Promise<FetchResult<Nullable<T>>>;
}

export interface ITileUrlBuilder {
    buildUrl(address: ITileAddress, ...params: unknown[]): string;
}

export interface ITileCodec<T> {
    decodeAsync(r: void | Response): Promise<Nullable<T>>;
}

export interface ITileClient<T> extends ITileDatasource<T, ITileAddress> {}
