import { IDisposable, Nullable } from "../types";
import { IEnvelope, IGeo2, IGeoBounded } from "../geography/geography.interfaces";
import { IBounded, ICartesian2, IRectangle, ISize2 } from "../geometry/geometry.interfaces";
import { Observable } from "../events/events.observable";
import { PropertyChangedEventArgs } from "../events/events.args";
import { IMemoryCache } from "../cache/cache";
export declare function isTileAddress(b: unknown): b is ITileAddress;
export interface ITileAddress extends ICartesian2 {
    levelOfDetail: number;
    quadkey: string;
}
export interface ITileSection extends ICartesian2, ISize2 {
    address: ITileAddress;
}
export declare function IsTileSection(b: unknown): b is ITileSection;
export interface ITileCruncher<T> {
    Downsampling(childs: T[]): Nullable<T>;
    Upsampling(parent: T, sectionIndex: number): Nullable<T>;
}
export declare function IsTileContentView<T>(b: unknown): b is ITileSection;
export type TileContentType<T> = Nullable<T | ITileSection>;
export interface ITile<T> extends IGeoBounded, IBounded {
    namespace?: string;
    address: ITileAddress;
    content: TileContentType<T>;
    quadkey: string;
}
export interface ITileCollection<T> extends Iterable<ITile<T>>, IGeoBounded, IBounded {
    count: number;
    has(address: ITileAddress): boolean;
    get(address: ITileAddress): ITile<T> | undefined;
    getAll(...tile: Array<ITileAddress>): void;
    add(tile: ITile<T>): void;
    addAll(...tile: Array<ITile<T>>): void;
    remove(address: ITileAddress): void;
    removeAll(...address: Array<ITileAddress>): void;
    clear(): void;
    intersect(bounds?: IRectangle | IEnvelope): IterableIterator<ITile<T>>;
}
export interface ITileProxy<T> {
    delegate: ITile<T>;
}
export interface ITileBuilder<T> {
    withNamespace(namespace: string): ITileBuilder<T>;
    withAddress(a: ITileAddress): ITileBuilder<T>;
    withData(d: TileContentType<T>): ITileBuilder<T>;
    withMetrics(metrics: ITileMetrics): ITileBuilder<T>;
    withType(type: new (...args: any[]) => ITile<T>): ITileBuilder<T>;
    build(): ITile<T>;
}
export declare enum CellCoordinateReference {
    center = "center",
    nw = "nw",
    ne = "ne",
    sw = "sw",
    se = "se"
}
export interface ITileSystemBounds {
    propertyChangedObservable: Observable<PropertyChangedEventArgs<ITileSystemBounds, unknown>>;
    minLOD: number;
    maxLOD: number;
    minLatitude: number;
    maxLatitude: number;
    minLongitude: number;
    maxLongitude: number;
    unionInPlace(bounds: ITileSystemBounds): void;
    copyInPlace(bounds: ITileSystemBounds): void;
}
export declare function IsTileSystemBounds(b: unknown): b is ITileSystemBounds;
export interface ITileSystem extends ITileSystemBounds {
    tileSize: number;
    cellSize: number;
    cellCoordinateReference: CellCoordinateReference;
    overlap: number;
}
export interface ITileMetrics extends ITileSystem {
    mapSize(levelOfDetail: number): number;
    mapScale(latitude: number, levelOfDetail: number, dpi: number): number;
    groundResolution(latitude: number, levelOfDetail: number): number;
    getLatLonToTileXY(latitude: number, longitude: number, levelOfDetail: number): ICartesian2;
    getTileXYToLatLon(x: number, y: number, levelOfDetail: number): IGeo2;
    getLatLonToPixelXY(latitude: number, longitude: number, levelOfDetail: number): ICartesian2;
    getPixelXYToLatLon(x: number, y: number, levelOfDetail: number): IGeo2;
    getTileXYToPixelXY(x: number, y: number): ICartesian2;
    getPixelXYToTileXY(x: number, y: number): ICartesian2;
    getLatLonToTileXYToRef(latitude: number, longitude: number, levelOfDetail: number, tileXY?: ICartesian2): void;
    getTileXYToLatLonToRef(x: number, y: number, levelOfDetail: number, latLon?: IGeo2): void;
    getLatLonToPixelXYToRef(latitude: number, longitude: number, levelOfDetail: number, pixelXY?: ICartesian2): void;
    getPixelXYToLatLonToRef(x: number, y: number, levelOfDetail: number, latLon?: IGeo2): void;
    getTileXYToPixelXYToRef(x: number, y: number, pixelXY?: ICartesian2): void;
    getPixelXYToTileXYToRef(x: number, y: number, tileXY?: ICartesian2): void;
}
export interface ITileMetricsProvider {
    metrics: ITileMetrics;
}
export declare class FetchResult<T> {
    address: ITileAddress;
    content: T;
    userArgs: Nullable<Array<unknown>>;
    static Null<T>(address: ITileAddress, userArgs: Nullable<Array<unknown>>): FetchResult<Nullable<T>>;
    status?: number;
    statusText?: string;
    constructor(address: ITileAddress, content: T, userArgs?: Nullable<Array<unknown>>);
}
export interface ITileDatasource<T, A extends ITileAddress> extends ITileMetricsProvider {
    name: string;
    fetchAsync(address: A, ...userArgs: Array<unknown>): Promise<FetchResult<Nullable<T>>>;
}
export declare function IsTileDatasource<T, A extends ITileAddress>(b: unknown): b is ITileDatasource<T, A>;
export interface ITileUrlBuilder {
    buildUrl(address: ITileAddress, ...params: unknown[]): string;
}
export interface ITileCodec<T> {
    decodeAsync(r: void | Response): Promise<Nullable<T>>;
}
export interface ITileClient<T> extends ITileDatasource<T, ITileAddress> {
}
export interface ITileContentProvider<T> extends ITileMetricsProvider, IDisposable {
    name: string;
    datasource: ITileDatasource<T, ITileAddress>;
    accept(address: ITileAddress): boolean;
    fetchContent(tile: ITile<T>, callback: (a: ITile<T>) => void): ITile<T>;
}
export interface ITileContentProviderBuilder<T> {
    withDatasource(datasource: ITileDatasource<T, ITileAddress>): ITileContentProviderBuilder<T>;
    withCache(cache: IMemoryCache<string, TileContentType<T>>): ITileContentProviderBuilder<T>;
    build(): ITileContentProvider<T>;
}
export declare function IsTileContentProviderBuilder<T>(b: unknown): b is ITileContentProviderBuilder<T>;
export interface ITileProvider<T> extends ITileMetricsProvider, IDisposable, IGeoBounded, IBounded {
    updatedObservable: Observable<ITile<T>>;
    enabledObservable: Observable<ITileProvider<T>>;
    name: string;
    contentProvider: ITileContentProvider<T>;
    factory: ITileBuilder<T>;
    enabled: boolean;
    activTiles: ITileCollection<T>;
    activateTile(...address: Array<ITileAddress>): Array<ITile<T>>;
    deactivateTile(...address: Array<ITileAddress>): Array<ITile<T>>;
}
export declare function IsTileProvider<T>(b: unknown): b is ITileProvider<T>;
export interface ITileProviderBuilder<T> {
    withEnabled(enabled: boolean): ITileProviderBuilder<T>;
    withFactory(factory: ITileBuilder<T>): ITileProviderBuilder<T>;
    withContentProvider(contentProvider: ITileContentProvider<T> | ITileContentProviderBuilder<T>): ITileProviderBuilder<T>;
    build(): ITileProvider<T>;
}
export declare function IsTileProviderBuilder<T>(b: unknown): b is ITileProviderBuilder<T>;
