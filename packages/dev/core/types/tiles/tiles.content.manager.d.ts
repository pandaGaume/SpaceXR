import { IMemoryCache } from "core/utils/cache";
import { ITileAddress, ITileDatasource, ITileMetrics } from "./tiles.interfaces";
import { Nullable } from "core/types";
import { Observable } from "core/events/events.observable";
import { EventArgs } from "core/events/events.args";
export declare class ContentUpdateEventArgs<T> extends EventArgs<TileContentManager<T>> {
    _address: ITileAddress;
    _content: Nullable<T>;
    constructor(address: ITileAddress, content: Nullable<T>, sender: TileContentManager<T>);
    get address(): ITileAddress;
    get content(): Nullable<T>;
}
export declare class TileContentManager<T> {
    private _cache;
    private _datasource;
    _contentUpdateObservable?: Observable<ContentUpdateEventArgs<T>>;
    constructor(datasource: ITileDatasource<T, ITileAddress>, cache?: IMemoryCache<string, T>);
    get cache(): IMemoryCache<string, Nullable<T>>;
    get datasource(): ITileDatasource<T, ITileAddress>;
    get metrics(): ITileMetrics;
    get contentUpdateObservable(): Observable<ContentUpdateEventArgs<T>>;
    getTileContent(address: ITileAddress): Nullable<T> | undefined;
    protected buildAlternativeTileContent(address: ITileAddress): Nullable<T>;
    private onContentObserverAdded;
}
