import { IMemoryCache } from "core/utils/cache";
import { ITileAddress, ITileDatasource } from "./tiles.interfaces";
import { Nullable } from "core/types";
import { Observable } from "core/events/events.observable";
import { EventArgs } from "core/events/events.args";
export declare class ContentUpdateEventArgs<T> extends EventArgs<TileContentManager<T>> {
    _address: ITileAddress;
    _content: Nullable<T>;
    constructor(address: ITileAddress, content: Nullable<T>, sender: TileContentManager<T>);
    get Address(): ITileAddress;
    get Content(): Nullable<T>;
}
export declare class TileContentManager<T> {
    private _cache;
    private _datasource;
    _contentUpdateObservable?: Observable<ContentUpdateEventArgs<T>>;
    constructor(datasource: ITileDatasource<T, ITileAddress>, cache?: IMemoryCache<string, T>);
    get Cache(): IMemoryCache<string, Nullable<T>>;
    get Datasource(): ITileDatasource<T, ITileAddress>;
    get ContentUpdateObservable(): Observable<ContentUpdateEventArgs<T>>;
    GetTileContent(address: ITileAddress): Nullable<T> | undefined;
    private onContentObserverAdded;
    private _buildTileContent;
}
