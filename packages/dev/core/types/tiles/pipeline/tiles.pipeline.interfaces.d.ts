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
export interface ITileView extends ITilePipelineComponent {
    addressAddedObservable: Observable<Array<ITileAddress>>;
    addressRemovedObservable: Observable<Array<ITileAddress>>;
    state: Nullable<ITileNavigationState>;
    display: Nullable<ITileDisplay>;
}
export interface ITileProducer<T> extends ITilePipelineComponent, ITileMetricsProvider {
    tileUpdatedObservable: Observable<ITile<T>>;
    tileAddedObservable: Observable<Array<ITile<T>>>;
    tileRemovedObservable: Observable<Array<ITile<T>>>;
    view?: ITileView;
    providers(predicate?: (p: ITileProvider<T>) => boolean): IterableIterator<ITileProvider<T>>;
    getTile(address: ITileAddress, ...userArgs: Array<unknown>): Nullable<ITile<T>[]>;
    addProvider(system: ITileProvider<T>): void;
    removeProvider(name: string): void;
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
