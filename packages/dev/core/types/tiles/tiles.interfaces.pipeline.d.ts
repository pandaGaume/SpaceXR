import { ICartesian2 } from "../geometry/geometry.interfaces";
import { EventArgs } from "../events/events.args";
import { Observable } from "../events/events.observable";
import { Nullable } from "../types";
import { ITile, ITileAddress, ITileMetricsProvider, TileContent } from "./tiles.interfaces";
import { ITileMapApi } from "./tiles.interfaces.api";
export interface IPipelineComponent {
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
    constructor(address: ITileAddress, value: T, sender: S);
    get address(): ITileAddress;
    get value(): T;
}
export declare class ContentUpdateEventArgs<T> extends AddressValueEventArgs<ITileContentProvider<T>, TileContent<T>> {
    private _result;
    constructor(address: ITileAddress, content: TileContent<T>, sender: ITileContentProvider<T>, result?: number);
    get content(): TileContent<T>;
    get result(): number;
}
export interface ITileContentProvider<T> extends ITileMetricsProvider, IPipelineComponent {
    contentUpdateObservable: Observable<ContentUpdateEventArgs<T>>;
    accept(address: ITileAddress): boolean;
    getTileContent(address: ITileAddress): Nullable<TileContent<T>>;
}
export declare class TilePipelineEventArgs<S, T> extends EventArgs<S> {
    private _infos;
    private _values;
    constructor(sender: S, infos: IContextMetrics, ...values: T[]);
    get infos(): IContextMetrics;
    get values(): T[];
}
export declare class TileMapEventArgs extends TilePipelineEventArgs<IMapView, ITileAddress> {
    constructor(sender: IMapView, infos: IContextMetrics, ...values: ITileAddress[]);
    get addresses(): ITileAddress[];
}
export interface IMapView extends ITileMapApi, IPipelineComponent {
    addressAddedObservable: Observable<TileMapEventArgs>;
    addressRemovedObservable: Observable<TileMapEventArgs>;
}
export declare class TileProviderEventArgs<T> extends TilePipelineEventArgs<ITileProvider<T>, ITile<T>> {
    constructor(sender: ITileProvider<T>, infos: IContextMetrics, ...values: ITile<T>[]);
    get tiles(): ITile<T>[];
}
export interface ITileProvider<T> extends ITileMetricsProvider, IPipelineComponent {
    tileUpdateObservable: Observable<TileProviderEventArgs<T>>;
    tileAddedObservable: Observable<TileProviderEventArgs<T>>;
    tileRemovedObservable: Observable<TileProviderEventArgs<T>>;
    getTile(address: ITileAddress): Nullable<ITile<T>[]>;
    addContentProvider(contentProvider: ITileContentProvider<T>): void;
    removeContentProvider(contentProvider: ITileContentProvider<T>): void;
    getProviderByName(name: string): ITileContentProvider<T>;
}
