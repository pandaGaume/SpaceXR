import { ICloneable, IDisposable, Nullable } from "../types";
import { IEnvelope, IGeo2, IGeoBounded, IsGeoBounded } from "../geography/geography.interfaces";
import { IBounded, ICartesian2, IBounds2 } from "../geometry/geometry.interfaces";
import { Observable } from "../events/events.observable";
import { PropertyChangedEventArgs } from "../events/events.args";
import { IMemoryCache } from "../cache/cache";

export function IsTileAddress(b: unknown): b is ITileAddress {
    if (typeof b !== "object" || b === null) return false;
    return (<ITileAddress>b).x !== undefined && (<ITileAddress>b).y !== undefined && (<ITileAddress>b).levelOfDetail !== undefined;
}

export interface ITileAddress extends ICartesian2 {
    levelOfDetail: number;
    quadkey: string;
}

export type TileContentType<T> = Nullable<T>;

export interface ITile<T> extends IGeoBounded, IBounded {
    namespace?: string;
    address: ITileAddress;
    content: TileContentType<T>;
    quadkey: string; // shortcut for address.quadkey
}

export function IsTile<T>(b: unknown): b is ITile<T> {
    if (typeof b !== "object" || b === null) return false;
    return IsGeoBounded(b) && (<any>b).address !== undefined && (<any>b).content !== undefined;
}

/// <summary>
/// The TileCollection is a collection of tiles, it is used to store the active tiles of a provider
/// Tile are stored using a quadkey index, this allow fast access to a tile using its address only.
/// Namespace is supposed to be consistent within a collection.
/// The collection also provide the overall bounds (geographical and pixel) of the tiles it contains.
/// </summary>
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

export function IsTileCollection<T>(b: unknown): b is ITileCollection<T> {
    if (typeof b !== "object" || b === null) return false;
    return (
        (<any>b).count !== undefined &&
        (<any>b).has !== undefined &&
        (<any>b).get !== undefined &&
        (<any>b).getAll !== undefined &&
        (<any>b).add !== undefined &&
        (<any>b).addAll !== undefined &&
        (<any>b).remove !== undefined &&
        (<any>b).removeAll !== undefined &&
        (<any>b).clear !== undefined &&
        (<any>b).intersect !== undefined
    );
}

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

export enum CellCoordinateReference {
    CENTER,
    NW,
    NE,
    SW,
    SE,
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
    copyInPlace(bounds: ITileSystemBounds): void;
}

export function IsTileSystemBounds(b: unknown): b is ITileSystemBounds {
    if (b === null || typeof b !== "object") return false;
    return (
        (<ITileSystemBounds>b).minLOD !== undefined &&
        (<ITileSystemBounds>b).maxLOD !== undefined &&
        (<ITileSystemBounds>b).minLatitude !== undefined &&
        (<ITileSystemBounds>b).maxLatitude !== undefined &&
        (<ITileSystemBounds>b).minLongitude !== undefined &&
        (<ITileSystemBounds>b).maxLongitude !== undefined
    );
}

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

export function IsTileMetricsProvider(b: unknown): b is ITileMetricsProvider {
    if (b === null || typeof b !== "object") return false;
    return (<ITileMetricsProvider>b).metrics !== undefined;
}

export class FetchResult<T> {
    public static Null<T>(address: ITileAddress, userArgs: Nullable<Array<unknown>>): FetchResult<Nullable<T>> {
        return new FetchResult<Nullable<T>>(address, null, userArgs);
    }

    ok?: boolean = true;
    status?: number;
    statusText?: string;
    public constructor(public address: ITileAddress, public content: T, public userArgs: Nullable<Array<unknown>> = null) {}
}

export interface ITileDatasource<T, A extends ITileAddress> extends ITileMetricsProvider {
    name: string;
    fetchAsync(address: A, env?: IGeoBounded, ...userArgs: Array<unknown>): Promise<FetchResult<Nullable<T>>>;
}

export function IsTileDatasource<T, A extends ITileAddress>(b: unknown): b is ITileDatasource<T, A> {
    if (b === null || typeof b !== "object") return false;
    return (<ITileDatasource<T, A>>b).fetchAsync !== undefined && (<ITileDatasource<T, A>>b).metrics !== undefined;
}

export interface ITileUrlBuilder {
    buildUrl(address: ITileAddress, ...params: unknown[]): string;
}

export interface ITileCodec<T> {
    decodeAsync(r: void | Response): Promise<Nullable<T>>;
}

export interface ITileClient<T> extends ITileDatasource<T, ITileAddress> {}

/// <summary>
/// Act as decorator arround ITileDatasource to provide address filtering, content generation and also caching capabilities
/// </summary>
export interface ITileContentProvider<T> extends ITileMetricsProvider, IDisposable {
    name: string; // usually shortcut for datasource?.name
    datasource: ITileDatasource<T, ITileAddress>; // the underlying data source
    accept(address: ITileAddress): boolean; // filter address, default is TileAddress.IsValidAddress(address, this.metrics)
    fetchContent(tile: ITile<T>, callback: (a: ITile<T>) => void): ITile<T>; // fetch content using datasource.
}

export interface ITileContentProviderBuilder<T> {
    // name and metrics are comming from data sourec
    withDatasource(datasource: ITileDatasource<T, ITileAddress>): ITileContentProviderBuilder<T>;
    withCache(cache: IMemoryCache<string, TileContentType<T>>): ITileContentProviderBuilder<T>;
    build(): ITileContentProvider<T>;
}

export function IsTileContentProviderBuilder<T>(b: unknown): b is ITileContentProviderBuilder<T> {
    if (b === null || typeof b !== "object") return false;
    return (
        (<ITileContentProviderBuilder<T>>b).build !== undefined &&
        (<ITileContentProviderBuilder<T>>b).withDatasource !== undefined &&
        (<ITileContentProviderBuilder<T>>b).withCache !== undefined
    );
}

export interface IHasNamespace {
    namespace: string;
}

export interface IHasActivTiles<T> {
    activTiles: ITileCollection<T>;
}

export interface IActivateTiles<T> {
    activateTile(...address: Array<ITileAddress>): Array<ITile<T>>; // activate tiles by addresses
    deactivateTile(...address: Array<ITileAddress>): Array<ITile<T>>; // deactivate tiles by addresses, if no address is provided, all tiles are deactivated, this is the preffered way to dispose the provider
}

/// <summary>
/// Used as entry point to Tile Data source. It is responsible for managing the lifecycle of the datasource and the content provider
/// plus dealing with the asynchronous nature of the data source, by providing update notification.
/// The main interaction is done using activateTile and deactivateTile methods which are messaging the datasource and content provider and also
/// managing the local cache
/// </summary>
export interface ITileProvider<T> extends IHasNamespace, IHasActivTiles<T>, IActivateTiles<T>, ITileMetricsProvider, IDisposable, IGeoBounded, IBounded {
    updatedObservable: Observable<ITile<T>>; // messaged when a tile is updated
    enabledObservable: Observable<ITileProvider<T>>; // messaged when the provider is enabled/disabled
    factory: ITileBuilder<T>; // the factory used to build the tile, if none is provided, the default one located into Tile<T> class is used
    enabled: boolean; // enable/disable the provider
}

export function IsTileProvider<T>(b: unknown): b is ITileProvider<T> {
    if (b === null || typeof b !== "object") return false;
    return (<ITileProvider<T>>b).activateTile !== undefined && (<ITileProvider<T>>b).deactivateTile !== undefined;
}

export interface ITileProviderBuilder<T> {
    withEnabled(enabled: boolean): ITileProviderBuilder<T>;
    withFactory(factory: ITileBuilder<T>): ITileProviderBuilder<T>;
    withContentProvider(contentProvider: ITileContentProvider<T> | ITileContentProviderBuilder<T>): ITileProviderBuilder<T>;
    build(): ITileProvider<T>;
}

export function IsTileProviderBuilder<T>(b: unknown): b is ITileProviderBuilder<T> {
    if (b === null || typeof b !== "object") return false;
    return (
        (<ITileProviderBuilder<T>>b).build !== undefined &&
        (<ITileProviderBuilder<T>>b).withEnabled !== undefined &&
        (<ITileProviderBuilder<T>>b).withFactory !== undefined &&
        (<ITileProviderBuilder<T>>b).withContentProvider !== undefined
    );
}
