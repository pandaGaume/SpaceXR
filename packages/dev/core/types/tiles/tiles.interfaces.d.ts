import { ICloneable, IDisposable, IValidable, Nullable } from "../types";
import { IEnvelope, IGeo2, IGeoBounded } from "../geography/geography.interfaces";
import { IBounded, ICartesian2, IBounds } from "../geometry/geometry.interfaces";
import { Observable } from "../events/events.observable";
import { PropertyChangedEventArgs } from "../events/events.args";
import { ITransformBlock } from "./pipeline";
import { FetchResult } from "../io";
export declare function IsTileAddress(b: unknown): b is ITileAddress2;
export declare function IsArrayOfTileAddress(b: unknown): b is Array<ITileAddress2>;
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
export interface ITileAddress {
    metadata?: Record<string, any>;
}
export interface ITileAddress2 extends ITileAddress, ICartesian2 {
    levelOfDetail: number;
    quadkey: string;
}
export interface ITileAddress3 extends ITileAddress, IBounded {
    tileId: string;
}
export interface ITileAddressable2 {
    namespace?: string;
    address: ITileAddress2;
    quadkey: string;
}
export type TileContentType<T> = Nullable<T>;
export interface ITile<T> extends ITileAddressable2, IGeoBounded, IBounded {
    content: TileContentType<T>;
}
export declare function IsTile<T>(b: unknown): b is ITile<T>;
export declare function IsArrayOfTile<T>(b: unknown): b is Array<ITile<T>>;
export type TileConstructor<T> = new (...args: any[]) => ITile<T>;
export declare function IsTileConstructor<T>(obj: any): obj is TileConstructor<T>;
export interface ITileCollection<T> extends Iterable<ITile<T>>, IGeoBounded, IBounded {
    namespace?: string;
    count: number;
    has(address: ITileAddress2): boolean;
    get(address: ITileAddress2): ITile<T> | undefined;
    getAll(...tile: Array<ITileAddress2>): void;
    add(tile: ITile<T>): void;
    addAll(...tile: Array<ITile<T>>): void;
    remove(address: ITileAddress2): void;
    removeAll(...address: Array<ITileAddress2>): void;
    clear(): void;
    intersect(bounds?: IBounds | IEnvelope): IterableIterator<ITile<T>>;
}
export declare function IsTileCollection<T>(b: unknown): b is ITileCollection<T>;
export interface ITileProxy<T> {
    delegate: ITile<T>;
}
export interface ITileBuilder<T> extends ITileMetricsProvider, IHasNamespace {
    withNamespace(namespace: string): ITileBuilder<T>;
    withAddress(a: ITileAddress2): ITileBuilder<T>;
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
    boundsFactory?: (a: ITile<unknown>, metrics: ITileMetrics) => IBounds;
    geoBoundsFactory?: (a: ITile<unknown>, metrics: ITileMetrics) => IEnvelope;
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
export interface ITileDatasource<T, A extends ITileAddress2> extends ITileMetricsProvider {
    name: string;
    fetchAsync(address: A, env?: IGeoBounded, ...userArgs: Array<unknown>): Promise<FetchResult<A, Nullable<T>>>;
}
export declare function IsTileDatasource<T, A extends ITileAddress2>(b: unknown): b is ITileDatasource<T, A>;
export interface ITileClient<T> extends ITileDatasource<T, ITileAddress2> {
}
export interface ITileContentProvider<T> extends ITileMetricsProvider, IDisposable {
    name: string;
    datasource: ITileDatasource<T, ITileAddress2>;
    accept(address: ITileAddress2): boolean;
    fetchContent(tile: ITile<T>, callback: (a: ITile<T>) => void): ITile<T>;
}
export interface IHasNamespace {
    namespace: string;
}
export interface IHasActivTiles<T> {
    activTiles: Array<Nullable<ITile<T>>>;
    getTile(a: ITileAddress2): Nullable<ITile<T>> | undefined;
    hasTile(a: ITileAddress2): boolean;
}
export interface ITileProvider<T> extends ITransformBlock<ITileAddress2, ITile<T>>, IValidable, IHasNamespace, IHasActivTiles<T>, ITileMetricsProvider, IDisposable, IGeoBounded, IBounded {
    enabledObservable: Observable<ITileProvider<T>>;
    enabled: boolean;
    factory: ITileBuilder<T>;
}
