import { Observable } from "../../events/events.observable";
import { IDisposable, Nullable } from "../../types";
import { ITile, ITileAddress, ITileAddressProcessor, ITileBuilder, ITileDatasource, ITileMetricsProvider, TileContent } from "../tiles.interfaces";
import { ISize2 } from "../../geometry/geometry.interfaces";
import { ITileNavigationState } from "../navigation/tiles.navigation.interfaces";
import { PropertyChangedEventArgs } from "../../events/events.args";

export interface ITilePipelineComponent extends IDisposable {
    id?: string;
}

export interface ITileDisplay extends ISize2, IDisposable {
    resizeObservable: Observable<PropertyChangedEventArgs<ITileDisplay, ISize2>>;
    setSize(w: number, h: number): ITileDisplay;
}

export interface ITileContentProvider<T> extends ITileMetricsProvider, IDisposable {
    name: string;
    zindex: number;
    datasource: ITileDatasource<T, ITileAddress>;
    accept(address: ITileAddress): boolean;
    fetchContentAsync(address: ITileAddress, ...userArgs: Array<unknown>): Promise<Nullable<TileContent<T>>>;
}

export interface ITileProvider<T> extends ITileMetricsProvider, IDisposable {
    tileUpdatedObservable: Observable<ITile<T>>;
    enableObservable: Observable<ITileProvider<T>>;
    name: string;
    zindex: number;
    addressProcessor?: ITileAddressProcessor;
    contentProvider: ITileContentProvider<T>;
    factory: ITileBuilder<T>;
    activTiles(): IterableIterator<ITile<T>>;
    activateTile(...address: Array<ITileAddress>): Array<ITile<T>>;
    deactivateTile(...address: Array<ITileAddress>): Array<ITile<T>>;
    enabled: boolean;
}

/// <summary>
/// The View component is tasked with selecting appropriate tile addresses, guided by the Tile Metrics and navigation properties. Its role is expanded to include the following:
/// - Tile Selection Based on Navigation Properties: Considers the geographic center, azimuth, and level of detail in tile selection, ensuring relevance and accuracy.
/// - Dimension and Scalability: Defines the dimension in unitless TileXY units, enabling flexibility and adaptability to different screen sizes and resolutions.
/// - Event Management Through Observable Pattern: Crucially, the View is responsible for managing events using the observable pattern. It sends notifications about 'Added'
///   and 'Removed' TileAddresses, allowing other components of the system to react and update accordingly. This feature is vital for ensuring that the system remains dynamic
///   and responsive to changes, such as user navigation or zoom adjustments.
/// </summary>
export interface ITileView extends ITilePipelineComponent {
    addressAddedObservable: Observable<Array<ITileAddress>>;
    addressRemovedObservable: Observable<Array<ITileAddress>>;
    state: Nullable<ITileNavigationState>;
    display: Nullable<ITileDisplay>;
}

export interface ITileProducer<T> extends ITilePipelineComponent, ITileMetricsProvider {
    /// <summary> messaged when a tile is updated </summary>
    tileUpdatedObservable: Observable<ITile<T>>;

    /// <summary> messaged when a tile is added </summary>
    tileAddedObservable: Observable<Array<ITile<T>>>;

    /// <summary> messaged when a tile is removed </summary>
    tileRemovedObservable: Observable<Array<ITile<T>>>;

    view?: ITileView;

    providers(predicate?: (p: ITileProvider<T>) => boolean): IterableIterator<ITileProvider<T>>;

    /// <summary>
    /// Get tiles using one address. Typically used by the pipeline, this method is using the underlying providers,
    /// first to verify if the content provider are accepting the address, and then ask for the contents itself.
    /// </summary>
    getTile(address: ITileAddress, ...userArgs: Array<unknown>): Nullable<ITile<T>[]>;

    /// <summary> register a content provider to the pipeline </summary>
    addProvider(system: ITileProvider<T>): void;

    /// <summary> unregister a content provider from the pipeline </summary>
    removeProvider(name: string): void;

    /// <summary> get a content provider from the pipeline using is name. Name is usually comming from ITile.namespace. </summary>
    getProviderByName(name: string): ITileProvider<T> | undefined;
}

export interface ITileConsumer<T> extends ITilePipelineComponent {
    addProducer(producer: ITileProducer<T>): void;
    removeProducer(name: string): void;
    getProducerByName(name: string): ITileProducer<T> | undefined;
}

export interface ITilePipeline<T> extends ITileMetricsProvider, IDisposable {
    view: ITileView;
    producer: ITileProducer<T>;
    consumer: ITileConsumer<T>;
}
