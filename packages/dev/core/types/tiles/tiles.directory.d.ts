import { Nullable } from "../types";
import { CacheEntry, CachePolicy, EvictionReason, MemoryCache, PostEvictionCallback } from "../utils/cache";
import { ITile, ITileAddress, ITileBuilder, ITileDatasource, ITileDirectory, ITileMetrics, LookupResult } from "./tiles.interfaces";
export declare class TileDirectoryOptionsBuilder<V> {
    _tileBuilder?: ITileBuilder<V>;
    _cacheOptions?: CachePolicy;
    _metrics?: ITileMetrics;
    withTileBuilder(v: ITileBuilder<V> | undefined): TileDirectoryOptionsBuilder<V>;
    withCacheOptions(v: CachePolicy | undefined): TileDirectoryOptionsBuilder<V>;
    withMetrics(v: ITileMetrics | undefined): TileDirectoryOptionsBuilder<V>;
    build(): TileDirectoryOptions<V>;
}
export declare class TileDirectoryOptions<V> {
    static Default<T>(): TileDirectoryOptions<T>;
    tileBuilder?: ITileBuilder<V>;
    cacheOptions?: CachePolicy;
    metrics?: ITileMetrics;
    constructor(init?: Partial<TileDirectoryOptions<V>>);
}
export declare class TileDirectory<V> implements ITileDirectory<ITile<V>> {
    _name: string;
    _datasource: ITileDatasource<V, ITileAddress>;
    _cache: MemoryCache<string, ITile<V>>;
    _options: TileDirectoryOptions<V>;
    _postEvictionCallback: PostEvictionCallback<string, ITile<V>>;
    constructor(name: string, datasource: ITileDatasource<V, ITileAddress>, options?: TileDirectoryOptions<V>);
    get name(): string;
    get metrics(): ITileMetrics;
    lookupAsync(address: ITileAddress, ...userArgs: Array<unknown>): Promise<LookupResult<Nullable<ITile<V>>>>;
    protected buildTile(address: ITileAddress, data: Nullable<V>): ITile<V>;
    protected bindTile(key: string, t: ITile<V>): void;
    protected unbindTile(key: string, t: ITile<V> | undefined): void;
    protected onEntryEvicted(e: CacheEntry<string, ITile<V>>, reason: EvictionReason): void;
}
