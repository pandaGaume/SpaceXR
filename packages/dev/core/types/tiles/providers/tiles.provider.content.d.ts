import { IMemoryCache } from "../../cache/cache";
import { ITile, ITileAddress2, ITileContentProvider, ITileDatasource, ITileMetrics, TileContentType } from "../tiles.interfaces";
export declare class TileContentProvider<T> implements ITileContentProvider<T> {
    private _cache;
    private _ownCache;
    private _datasource;
    private _prefix?;
    constructor(datasource: ITileDatasource<T, ITileAddress2>, cache?: IMemoryCache<string, TileContentType<T>>);
    accept(address: ITileAddress2): boolean;
    get name(): string;
    get datasource(): ITileDatasource<T, ITileAddress2>;
    get metrics(): ITileMetrics;
    dispose(): void;
    fetchContent(tile: ITile<T>, callback: (t: ITile<T>) => void): ITile<T>;
    protected _buildTemporaryContent(address: ITileAddress2): TileContentType<T>;
    protected _buildAlternativContent(address: ITileAddress2): TileContentType<T>;
    protected _buildPrefix(): string;
    private _buildCacheKey;
}
