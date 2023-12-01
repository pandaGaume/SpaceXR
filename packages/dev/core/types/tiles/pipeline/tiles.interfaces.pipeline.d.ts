import { ICartesian2 } from "../../geometry/geometry.interfaces";
import { EventArgs, PropertyChangedEventArgs } from "../../events/events.args";
import { Observable } from "../../events/events.observable";
import { IDisposable, Nullable } from "../../types";
import { ITile, ITileAddress, ITileBuilder, ITileMetricsProvider, TileContent } from "../tiles.interfaces";
import { ITileMapApi } from "../api/tiles.interfaces.api";
export interface IPipelineComponent extends IDisposable {
    id?: string;
}
export interface IContextMetrics {
    lod: number;
    scale: number;
    center: ICartesian2;
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
export interface ITileContentProvider<T> extends ITileMetricsProvider, IPipelineComponent {
    contentUpdateObservable: Observable<ContentUpdateEventArgs<T>>;
    accept(address: ITileAddress): boolean;
    getTileContent(address: ITileAddress): Nullable<TileContent<T>>;
}
export interface ITileView extends IPipelineComponent {
    addressAddedObservable: Observable<Array<ITileAddress>>;
    addressRemovedObservable: Observable<Array<ITileAddress>>;
    api: Nullable<ITileMapApi>;
}
export interface ITileProvider<T> extends IPipelineComponent {
    tileUpdatedObservable: Observable<Array<ITile<T>>>;
    tileAddedObservable: Observable<Array<ITile<T>>>;
    tileRemovedObservable: Observable<Array<ITile<T>>>;
    getTile(address: ITileAddress): Nullable<ITile<T>[]>;
    addContentProvider<P extends T>(contentProvider: ITileContentProvider<P>, builder: ITileBuilder<P>): void;
    removeContentProvider<P extends T>(name: string): void;
    getProviderByName<P extends T>(name: string): ITileContentProvider<P> | undefined;
}
export interface ITileConsumer<T> extends IPipelineComponent {
    providerChangedObservable: Observable<PropertyChangedEventArgs<ITileConsumer<T>, ITileProvider<T>>>;
    provider?: ITileProvider<T>;
}
