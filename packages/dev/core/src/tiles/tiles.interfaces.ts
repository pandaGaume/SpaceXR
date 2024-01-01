import { IDisposable, Nullable } from "../types";
import { IGeo2, IGeoBounded } from "../geography/geography.interfaces";
import { ICartesian2, IRectangle, ISize2 } from "../geometry/geometry.interfaces";
import { Observable } from "../events/events.observable";
import { PropertyChangedEventArgs } from "../events/events.args";
import { IMemoryCache } from "../cache/cache";

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
    isCompatibleWith(metrics: ITileMetrics): boolean;
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

export interface ITileDisplay extends ISize2, IDisposable {
    resizeObservable: Observable<PropertyChangedEventArgs<ITileDisplay, ISize2>>;
    setSize(w: number, h: number): ITileDisplay;
}

/// <summary>
/// Act as decorator arround ITileDatasource to provide address filtering, content generation and also caching capabilities
/// </summary>
export interface ITileContentProvider<T> extends ITileMetricsProvider, IDisposable {
    name: string; // usually shortcut for datasource?.name
    datasource: ITileDatasource<T, ITileAddress>; // the underlying data source
    accept(address: ITileAddress): boolean; // filter address, default is TileAddress.IsValidAddress(address, this.metrics)
    fetchContentAsync(address: ITileAddress, ...userArgs: Array<unknown>): Promise<Nullable<TileContent<T>>>; // fetch content using datasource.
}

export interface ITileContentProviderBuilder<T> {
    // name and metrics are comming from data sourec
    withDatasource(datasource: ITileDatasource<T, ITileAddress>): ITileContentProviderBuilder<T>;
    withCache(cache: IMemoryCache<string, TileContent<T>>): ITileContentProviderBuilder<T>;
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

/// <summary>
/// Used as entry point to Tile Data source. It is responsible for managing the lifecycle of the datasource and the content provider
/// plus dealing with the asynchronous nature of the data source, by providing update notification.
/// The main interaction is done usin activateTile and deactivateTile methods which are messaging the datasource and content provider and also
/// managing the local cache
/// </summary>
export interface ITileProvider<T> extends ITileMetricsProvider, IDisposable {
    updatedObservable: Observable<ITile<T>>; // messaged when a tile is updated by the data source or the content provider
    enabledObservable: Observable<ITileProvider<T>>; // messaged when the provider is enabled/disabled

    name: string; // usually shortcut for contentProvider?.name
    addressProcessor?: ITileAddressProcessor; // give ability to filter and/or modify address before fetching content
    contentProvider: ITileContentProvider<T>; // the underlying data source
    factory: ITileBuilder<T>; // the factory used to build the tile, if none is provided, the default one located into Tile<T> class is used
    enabled: boolean; // enable/disable the provider

    getActivTiles(): IterableIterator<ITile<T>>; // return all active tiles
    activateTile(...address: Array<ITileAddress>): Array<ITile<T>>; // activate tiles by addresses
    deactivateTile(...address: Array<ITileAddress>): Array<ITile<T>>; // deactivate tiles by addresses, if no address is provided, all tiles are deactivated, this is the preffered way to dispose the provider
}

export interface ITileProviderBuilder<T> {
    withEnabled(enabled: boolean): ITileProviderBuilder<T>;
    withFactory(factory: ITileBuilder<T>): ITileProviderBuilder<T>;
    withAddressProcessor(processor: ITileAddressProcessor): ITileProviderBuilder<T>;
    withContentProvider(contentProvider: ITileContentProvider<T> | ITileContentProviderBuilder<T>): ITileProviderBuilder<T>;
    build(): ITileProvider<T>;
}

export function IsTileProviderBuilder<T>(b: unknown): b is ITileProviderBuilder<T> {
    if (b === null || typeof b !== "object") return false;
    return (
        (<ITileProviderBuilder<T>>b).build !== undefined &&
        (<ITileProviderBuilder<T>>b).withEnabled !== undefined &&
        (<ITileProviderBuilder<T>>b).withFactory !== undefined &&
        (<ITileProviderBuilder<T>>b).withAddressProcessor !== undefined &&
        (<ITileProviderBuilder<T>>b).withContentProvider !== undefined
    );
}
