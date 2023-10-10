import { IMemoryCache } from "core/utils/cache";
import { ITileAddress, ITileContentView, ITileDatasource, ITileMetrics, TileContent } from "./tiles.interfaces";
import { Observable } from "core/events/events.observable";
import { EventArgs } from "core/events/events.args";
import { ICartesian3 } from "..";
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
    protected buildTileContentView(content: T, address: ITileAddress, source?: ICartesian3, target?: ICartesian3): ITileContentView<T>;
    protected buildAlternativeTileContent(address: ITileAddress): TileContent<T>;
    private onContentObserverAdded;
}
