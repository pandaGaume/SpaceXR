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
type PipelineType = ITileView | ITileProvider<any>;
type PipelineValue = ITileAddress | ITile<any>[];
export declare class TilePipelineEventArgs extends EventArgs<PipelineType> {
    private _infos;
    private _values;
    constructor(sender: PipelineType, infos: IContextMetrics, ...values: PipelineValue[]);
    get infos(): IContextMetrics;
    get values(): PipelineValue[];
}
export interface ITileView extends ITileMapApi, IPipelineComponent {
    addressAddedObservable: Observable<TilePipelineEventArgs>;
    addressRemovedObservable: Observable<TilePipelineEventArgs>;
}
export interface ITileProvider<T> extends ITileMetricsProvider, IPipelineComponent {
    tileUpdateObservable: Observable<TilePipelineEventArgs>;
    tileAddedObservable: Observable<TilePipelineEventArgs>;
    tileRemovedObservable: Observable<TilePipelineEventArgs>;
    getTile(address: ITileAddress): Nullable<ITile<T>[]>;
    addContentProvider(contentProvider: ITileContentProvider<T>): void;
    removeContentProvider(contentProvider: ITileContentProvider<T>): void;
    getProviderByName(name: string): ITileContentProvider<T>;
}
export {};
