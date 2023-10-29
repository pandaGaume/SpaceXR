import { IMemoryCache } from "../utils/cache";
import { ITileAddress, TileSection, ITileDatasource, ITileMetrics, TileContent } from "./tiles.interfaces";
import { Observable } from "../events/events.observable";
import { EventArgs } from "../events/events.args";
export declare class ContentUpdateEventArgs<T> extends EventArgs<TileContentManager<T>> {
    _address: ITileAddress;
    _content: TileContent<T>;
    constructor(address: ITileAddress, content: TileContent<T>, sender: TileContentManager<T>);
    get address(): ITileAddress;
    get content(): TileContent<T>;
}
export declare class TileContentManager<T> {
    private _cache;
    private _datasource;
    _contentUpdateObservable?: Observable<ContentUpdateEventArgs<T>>;
    _smoothingZomm: boolean;
    constructor(datasource: ITileDatasource<T, ITileAddress>, cache?: IMemoryCache<string, TileContent<T>>);
    get cache(): IMemoryCache<string, TileContent<T>>;
    get datasource(): ITileDatasource<T, ITileAddress>;
    get metrics(): ITileMetrics;
    get contentUpdateObservable(): Observable<ContentUpdateEventArgs<T>>;
    getTileContent(address: ITileAddress): TileContent<T>;
    protected buildTileContentView(address: ITileAddress, source?: TileSection, target?: TileSection): TileContent<T> | undefined;
    protected buildAlternativeTileContent(address: ITileAddress): TileContent<T>;
    private onContentObserverAdded;
}
