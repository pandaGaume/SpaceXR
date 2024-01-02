import { IMemoryCache } from "../../cache/cache";
import { ITileAddress, ITileContentProvider, ITileDatasource, ITileMetrics, TileContent } from "../tiles.interfaces";
import { Nullable } from "../../types";
export declare class TileContentProvider<T> implements ITileContentProvider<T> {
    private _cache;
    private _ownCache;
    private _datasource;
    private _prefix?;
    constructor(datasource: ITileDatasource<T, ITileAddress>, cache?: IMemoryCache<string, TileContent<T>>);
    accept(address: ITileAddress): boolean;
    get name(): string;
    get datasource(): ITileDatasource<T, ITileAddress>;
    get metrics(): ITileMetrics;
    dispose(): void;
    fetchContentAsync(address: ITileAddress, ...userArgs: Array<unknown>): Promise<Nullable<TileContent<T>>>;
    protected buildTemporaryContent(address: ITileAddress): TileContent<T>;
    protected buildAlternativContent(address: ITileAddress): TileContent<T>;
    protected _buildPrefix(): string;
    private buildCacheKey;
}
