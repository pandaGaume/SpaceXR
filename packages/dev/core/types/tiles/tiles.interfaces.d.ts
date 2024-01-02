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
export interface ITileAddressProcessor {
    process(address: ITileAddress, metrics?: ITileMetrics): ITileAddress[] | ITileSection;
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
export type TileContent<T> = Nullable<T | ITileSection>;
export interface ITile<T> extends IGeoBounded, IBounded {
    namespace?: string;
    address: ITileAddress;
    content: TileContent<T>;
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
    isCompatibleWith(metrics: ITileMetrics): boolean;
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
export interface ITileUrlBuilder {
    buildUrl(address: ITileAddress, ...params: unknown[]): string;
}
export interface ITileCodec<T> {
    decodeAsync(r: void | Response): Promise<Nullable<T>>;
}
export interface ITileClient<T> extends ITileDatasource<T, ITileAddress> {
}
export interface ITileDisplay extends ICartesian2, ISize2, IDisposable {
    propertyChangedObservable: Observable<PropertyChangedEventArgs<ITileDisplay, unknown>>;
    resize(w: number, h: number): ITileDisplay;
    translate(x: number, y: number): ITileDisplay;
}
export interface ITileContentProvider<T> extends ITileMetricsProvider, IDisposable {
    name: string;
    datasource: ITileDatasource<T, ITileAddress>;
    accept(address: ITileAddress): boolean;
    fetchContentAsync(address: ITileAddress, ...userArgs: Array<unknown>): Promise<Nullable<TileContent<T>>>;
}
export interface ITileContentProviderBuilder<T> {
    withDatasource(datasource: ITileDatasource<T, ITileAddress>): ITileContentProviderBuilder<T>;
    withCache(cache: IMemoryCache<string, TileContent<T>>): ITileContentProviderBuilder<T>;
    build(): ITileContentProvider<T>;
}
export declare function IsTileContentProviderBuilder<T>(b: unknown): b is ITileContentProviderBuilder<T>;
export interface ITileProvider<T> extends ITileMetricsProvider, IDisposable, IGeoBounded, IBounded {
    updatedObservable: Observable<ITile<T>>;
    enabledObservable: Observable<ITileProvider<T>>;
    name: string;
    addressProcessor?: ITileAddressProcessor;
    contentProvider: ITileContentProvider<T>;
    factory: ITileBuilder<T>;
    enabled: boolean;
    activTiles: ITileCollection<T>;
    activateTile(...address: Array<ITileAddress>): Array<ITile<T>>;
    deactivateTile(...address: Array<ITileAddress>): Array<ITile<T>>;
}
export interface ITileProviderBuilder<T> {
    withEnabled(enabled: boolean): ITileProviderBuilder<T>;
    withFactory(factory: ITileBuilder<T>): ITileProviderBuilder<T>;
    withAddressProcessor(processor: ITileAddressProcessor): ITileProviderBuilder<T>;
    withContentProvider(contentProvider: ITileContentProvider<T> | ITileContentProviderBuilder<T>): ITileProviderBuilder<T>;
    build(): ITileProvider<T>;
}
export declare function IsTileProviderBuilder<T>(b: unknown): b is ITileProviderBuilder<T>;
