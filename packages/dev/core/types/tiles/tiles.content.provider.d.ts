import { IMemoryCache } from "../utils/cache";
import { ITileAddress, TileSection, ITileDatasource, ITileMetrics, TileContent } from "./tiles.interfaces";
import { ITileContentProvider, ContentUpdateEventArgs } from "./tiles.interfaces.pipeline";
import { Observable } from "../events/events.observable";
export declare class TileContentProvider<T> implements ITileContentProvider<T> {
    private _cache;
    private _datasource;
    _contentUpdateObservable?: Observable<ContentUpdateEventArgs<T>>;
    _smoothingZomm: boolean;
    constructor(datasource: ITileDatasource<T, ITileAddress>, cache?: IMemoryCache<string, TileContent<T>>);
    accept(address: ITileAddress): boolean;
    get id(): string | undefined;
    get cache(): IMemoryCache<string, TileContent<T>>;
    get datasource(): ITileDatasource<T, ITileAddress>;
    get metrics(): ITileMetrics;
    get contentUpdateObservable(): Observable<ContentUpdateEventArgs<T>>;
    private buildCacheKey;
    getTileContent(address: ITileAddress): TileContent<T>;
    protected buildTileContentView(address: ITileAddress, source?: TileSection, target?: TileSection): TileContent<T> | undefined;
    protected buildAlternativeTileContent(address: ITileAddress): TileContent<T>;
    private onContentObserverAdded;
}
