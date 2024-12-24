import { ICloneable, IDisposable, IValidable, Nullable } from "../types";
import { IEnvelope, IGeo2, IGeoBounded } from "../geography/geography.interfaces";
import { IBounded, ICartesian2, IBounds2 } from "../geometry/geometry.interfaces";
import { Observable } from "../events/events.observable";
import { PropertyChangedEventArgs } from "../events/events.args";
import { ITransformBlock } from "./pipeline";
export declare function IsTileAddress(b: unknown): b is ITileAddress;
export declare function IsArrayOfTileAddress(b: unknown): b is Array<ITileAddress>;
export declare enum NeighborsAddress {
    NW = 0,
    N = 1,
    NE = 2,
    W = 3,
    A = 4,
    E = 5,
    SW = 6,
    S = 7,
    SE = 8
}
export interface ITileAddress extends ICartesian2 {
    levelOfDetail: number;
    quadkey: string;
}
export interface ITileAddressable {
    namespace?: string;
    address: ITileAddress;
    quadkey: string;
}
export type TileContentType<T> = Nullable<T>;
export interface ITile<T> extends ITileAddressable, IGeoBounded, IBounded {
    content: TileContentType<T>;
}
export declare function IsTile<T>(b: unknown): b is ITile<T>;
export declare function IsArrayOfTile<T>(b: unknown): b is Array<ITile<T>>;
export interface ITileCollection<T> extends Iterable<ITile<T>>, IGeoBounded, IBounded {
    namespace?: string;
    count: number;
    has(address: ITileAddress): boolean;
    get(address: ITileAddress): ITile<T> | undefined;
    getAll(...tile: Array<ITileAddress>): void;
    add(tile: ITile<T>): void;
    addAll(...tile: Array<ITile<T>>): void;
    remove(address: ITileAddress): void;
    removeAll(...address: Array<ITileAddress>): void;
    clear(): void;
    intersect(bounds?: IBounds2 | IEnvelope): IterableIterator<ITile<T>>;
}
export declare function IsTileCollection<T>(b: unknown): b is ITileCollection<T>;
export interface ITileProxy<T> {
    delegate: ITile<T>;
}
export interface ITileBuilder<T> extends ITileMetricsProvider, IHasNamespace {
    withNamespace(namespace: string): ITileBuilder<T>;
    withAddress(a: ITileAddress): ITileBuilder<T>;
    withData(d: TileContentType<T>): ITileBuilder<T>;
    withMetrics(metrics: ITileMetrics): ITileBuilder<T>;
    withType(type: new (...args: any[]) => ITile<T>): ITileBuilder<T>;
    build(): ITile<T>;
}
export declare enum CellCoordinateReference {
    CENTER = 0,
    NW = 1,
    NE = 2,
    SW = 3,
    SE = 4
}
export interface ITileSystemBounds extends ICloneable<ITileSystemBounds> {
    propertyChangedObservable: Observable<PropertyChangedEventArgs<ITileSystemBounds, unknown>>;
    minLOD: number;
    maxLOD: number;
    minLatitude: number;
    maxLatitude: number;
    minLongitude: number;
    maxLongitude: number;
    unionInPlace(bounds: ITileSystemBounds): void;
    intersectionInPlace(bounds: ITileSystemBounds): void;
    copy(bounds: ITileSystemBounds): void;
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
    getLatLonToPointXY(latitude: number, longitude: number, levelOfDetail: number): ICartesian2;
    getPointXYToLatLon(x: number, y: number, levelOfDetail: number): IGeo2;
    getTileXYToPointXY(x: number, y: number): ICartesian2;
    getPointXYToTileXY(x: number, y: number): ICartesian2;
    getLatLonToTileXYToRef(latitude: number, longitude: number, levelOfDetail: number, tileXY?: ICartesian2): void;
    getTileXYToLatLonToRef(x: number, y: number, levelOfDetail: number, latLon?: IGeo2): void;
    getLatLonToPointXYToRef(latitude: number, longitude: number, levelOfDetail: number, pointXY?: ICartesian2): void;
    getPointXYToLatLonToRef(x: number, y: number, levelOfDetail: number, latLon?: IGeo2): void;
    getTileXYToPointXYToRef(x: number, y: number, pointXY?: ICartesian2): void;
    getPointXYToTileXYToRef(x: number, y: number, tileXY?: ICartesian2): void;
}
export interface ITileMetricsProvider {
    metrics: ITileMetrics;
}
export declare function IsTileMetricsProvider(b: unknown): b is ITileMetricsProvider;
export declare class FetchResult<T> {
    address: ITileAddress;
    content: T;
    userArgs: Nullable<Array<unknown>>;
    static Null<T>(address: ITileAddress, userArgs: Nullable<Array<unknown>>): FetchResult<Nullable<T>>;
    ok?: boolean;
    status?: number;
    statusText?: string;
    constructor(address: ITileAddress, content: T, userArgs?: Nullable<Array<unknown>>);
}
export interface ITileDatasource<T, A extends ITileAddress> extends ITileMetricsProvider {
    name: string;
    fetchAsync(address: A, env?: IGeoBounded, ...userArgs: Array<unknown>): Promise<FetchResult<Nullable<T>>>;
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
export interface IHasNamespace {
    namespace: string;
}
export interface IHasActivTiles<T> {
    activTiles: Array<Nullable<ITile<T>>>;
    getTile(a: ITileAddress): Nullable<ITile<T>> | undefined;
    hasTile(a: ITileAddress): boolean;
}
export interface ITileProvider<T> extends ITransformBlock<ITileAddress, ITile<T>>, IValidable, IHasNamespace, IHasActivTiles<T>, ITileMetricsProvider, IDisposable, IGeoBounded, IBounded {
    enabledObservable: Observable<ITileProvider<T>>;
    enabled: boolean;
    factory: ITileBuilder<T>;
}
