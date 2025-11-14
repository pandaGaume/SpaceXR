import { IMemoryCache } from "../../cache/cache";
import { ITile, ITile2DAddress, ITileAddress, ITileContentProvider, ITileDatasource, ITileMetrics, TileContentType } from "../tiles.interfaces";
export declare class TileContentProvider<T> implements ITileContentProvider<T> {
    private _cache;
    private _ownCache;
    private _datasource;
    private _prefix?;
    constructor(datasource: ITileDatasource<T, ITileAddress>, cache?: IMemoryCache<string, TileContentType<T>>);
    accept(address: ITile2DAddress): boolean;
    get name(): string;
    get datasource(): ITileDatasource<T, ITileAddress>;
    get metrics(): ITileMetrics | undefined;
    dispose(): void;
    fetchContent(tile: ITile<T>, callback: (t: ITile<T>) => void): ITile<T>;
    protected _buildTemporaryContent(address: ITile2DAddress): TileContentType<T>;
    protected _buildAlternativContent(address: ITile2DAddress): TileContentType<T>;
    protected _buildPrefix(): string;
    private _buildCacheKey;
}
