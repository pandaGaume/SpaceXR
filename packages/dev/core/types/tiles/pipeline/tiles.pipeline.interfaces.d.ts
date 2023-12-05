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
    datasource: ITileDatasource<T, ITileAddress>;
    accept(address: ITileAddress): boolean;
    fetchContentAsync(address: ITileAddress, ...userArgs: Array<unknown>): Promise<Nullable<TileContent<T>>>;
}
export interface ITileSystem<T> extends ITileMetricsProvider {
    name: string;
    addressProcessor?: ITileAddressProcessor;
    provider: ITileContentProvider<T>;
    factory: ITileBuilder<T>;
}
export interface ITileView<T> extends ITilePipelineComponent {
    addressAddedObservable: Observable<Array<ITileAddress>>;
    addressRemovedObservable: Observable<Array<ITileAddress>>;
    state: Nullable<ITileNavigationState>;
    display: Nullable<ITileDisplay>;
}
export interface ITileProvider<T> extends ITilePipelineComponent, ITileMetricsProvider {
    tileUpdatedObservable: Observable<Array<ITile<T>>>;
    tileAddedObservable: Observable<Array<ITile<T>>>;
    tileRemovedObservable: Observable<Array<ITile<T>>>;
    getTile(address: ITileAddress, ...userArgs: Array<unknown>): Nullable<ITile<T>[]>;
    addContentProvider<P extends T>(system: ITileSystem<P>): void;
    removeContentProvider(name: string): void;
    getContentProviderByName<P extends T>(name: string): ITileSystem<P> | undefined;
}
export interface ITileConsumer<T> extends ITilePipelineComponent {
    providerChangedObservable: Observable<PropertyChangedEventArgs<ITileConsumer<T>, ITileProvider<T>>>;
    provider?: ITileProvider<T>;
}
