import { EventArgs, PropertyChangedEventArgs } from "../../events/events.args";
import { Observable } from "../../events/events.observable";
import { IDisposable, IValidable, Nullable } from "../../types";
import { ITile, ITileAddress, ITileBuilder, ITileMetricsProvider, TileContent } from "../tiles.interfaces";
import { IGeo2 } from "../../geography/geography.interfaces";
import { ISize2 } from "../../geometry/geometry.interfaces";
export interface ITilePipelineComponent extends IDisposable {
    id?: string;
}
export interface ITileSystemComponent<T> extends ITileMetricsProvider, ITilePipelineComponent {
    system: ITileSystem<T>;
}
export interface ITileNavigationState extends IValidable<ITileNavigationState> {
    centerObservable: Observable<PropertyChangedEventArgs<ITileNavigationState, IGeo2>>;
    zoomObservable: Observable<PropertyChangedEventArgs<ITileNavigationState, number>>;
    azimuthObservable: Observable<PropertyChangedEventArgs<ITileNavigationState, number>>;
    stateChangedObservable: Observable<ITileNavigationState>;
    center: IGeo2;
    zoom: number;
    azimuth: number;
}
export interface ITileDisplay extends ISize2, IDisposable {
    resizeObservable: Observable<PropertyChangedEventArgs<ITileDisplay, ISize2>>;
    setSize(w: number, h: number): ITileDisplay;
}
export interface ITileView<T> extends ITileSystemComponent<T> {
    addressAddedObservable: Observable<Array<ITileAddress>>;
    addressRemovedObservable: Observable<Array<ITileAddress>>;
    state: Nullable<ITileNavigationState>;
    display: Nullable<ITileDisplay>;
}
export interface ITileProvider<T> extends ITileSystemComponent<T> {
    tileUpdatedObservable: Observable<Array<ITile<T>>>;
    tileAddedObservable: Observable<Array<ITile<T>>>;
    tileRemovedObservable: Observable<Array<ITile<T>>>;
    getTile(address: ITileAddress): Nullable<ITile<T>[]>;
    addContentProvider<P extends T>(contentProvider: ITileContentProvider<P>, builder: ITileBuilder<P>): void;
    removeContentProvider<P extends T>(name: string): void;
    getProviderByName<P extends T>(name: string): ITileContentProvider<P> | undefined;
}
export declare class AddressValueEventArgs<S, T> extends EventArgs<S> {
    _address: ITileAddress;
    _value: T;
    constructor(sender: S, address: ITileAddress, value: T);
    get address(): ITileAddress;
    get value(): T;
}
export declare class ContentUpdateEventArgs<T> extends AddressValueEventArgs<ITileContentProvider<T>, TileContent<T>> {
    private _result;
    constructor(sender: ITileContentProvider<T>, address: ITileAddress, content: TileContent<T>, result?: number);
    get content(): TileContent<T>;
    get result(): number;
}
export interface ITileContentProvider<T> extends ITileMetricsProvider, ITileSystemComponent<T> {
    contentUpdateObservable: Observable<ContentUpdateEventArgs<T>>;
    accept(address: ITileAddress): boolean;
    getTileContent(address: ITileAddress): Nullable<TileContent<T>>;
}
export interface ITileSystem<T> extends ITileMetricsProvider {
}
export interface ITileConsumer<T> extends ITilePipelineComponent {
    providerChangedObservable: Observable<PropertyChangedEventArgs<ITileConsumer<T>, ITileProvider<T>>>;
    provider?: ITileProvider<T>;
}
