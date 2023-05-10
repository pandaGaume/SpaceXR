import { ITile, ITileAddress, ITileBuilder, ITileDatasource, ITileDirectory, ITileMetrics } from "./tiles.interfaces";
type PostEvictionCallback<V> = (e: TileCacheEntry<V>) => void;
declare class TileCacheEntry<V> {
    _key: string;
    _value: ITile<V>;
    _se?: number;
    _lastAccess?: number;
    _callbacks?: Array<PostEvictionCallback<V>>;
    _next?: TileCacheEntry<V>;
    _prev?: TileCacheEntry<V>;
    constructor(value: ITile<V>);
    get key(): string;
    get value(): ITile<V>;
    set value(v: ITile<V>);
    get slidingExpiration(): number | undefined;
    set slidingExpiration(se: number | undefined);
    get expiration(): number;
    addPostEvictionCallback(c: PostEvictionCallback<V>): void;
    removeEvictionCallback(c: PostEvictionCallback<V>): void;
}
export declare class CachePolicy {
    slidingExpiration?: number;
    threshold?: number;
    constructor(init?: Partial<CachePolicy>);
}
export declare class CachePolicyBuilder {
    _slidingExpiration?: number;
    _threshold?: number;
    withSlidingExpiration(slidingExpiration: number | undefined): CachePolicyBuilder;
    withSlidingExpirationFromMinutes(slidingExpiration: number | undefined): CachePolicyBuilder;
    withSlidingExpirationFromSeconds(slidingExpiration: number | undefined): CachePolicyBuilder;
    withThreshold(threshold: number | undefined): CachePolicyBuilder;
    build(): CachePolicy;
}
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
export declare class TileDirectory<V> implements ITileDirectory<V> {
    _name: string;
    _datasource: ITileDatasource<V, ITileAddress>;
    _cache: Map<string, TileCacheEntry<V>>;
    _options: TileDirectoryOptions<V>;
    _postEvictionCallback: PostEvictionCallback<V>;
    constructor(name: string, datasource: ITileDatasource<V, ITileAddress>, options?: TileDirectoryOptions<V>);
    get name(): string;
    get metrics(): ITileMetrics;
    lookupAsync(address: ITileAddress): Promise<ITile<V> | undefined> | ITile<V> | undefined;
    protected buildTile(address: ITileAddress, data?: V): ITile<V>;
    protected bindTile(key: string, t: ITile<V>): void;
    protected unbindTile(key: string, t: ITile<V>): void;
    protected onEntryEvicted(e: TileCacheEntry<V>): void;
    protected gc(): void;
    _head?: TileCacheEntry<V>;
    _tail?: TileCacheEntry<V>;
    _count: number;
    _timer?: ReturnType<typeof setTimeout>;
    _gc: () => void;
    private sortList;
    private removeNode;
    private insertFirst;
    private insertLast;
    private insertAfter;
    private insertBefore;
}
export {};
