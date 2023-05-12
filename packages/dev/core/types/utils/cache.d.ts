export type PostEvictionCallback<K, V> = (e: CacheEntry<K, V>) => void;
export type CacheItemFactory<K, V> = (e: CacheEntry<K, V>) => V;
export declare class CachePolicyBuilder {
    _slidingExpiration?: number;
    _threshold?: number;
    withSlidingExpiration(slidingExpiration: number | undefined): CachePolicyBuilder;
    withSlidingExpirationFromMinutes(slidingExpiration: number | undefined): CachePolicyBuilder;
    withSlidingExpirationFromSeconds(slidingExpiration: number | undefined): CachePolicyBuilder;
    withThreshold(threshold: number | undefined): CachePolicyBuilder;
    build(): CachePolicy;
}
export declare class CachePolicy {
    static Default: CachePolicy;
    slidingExpiration?: number;
    threshold?: number;
    constructor(init?: Partial<CachePolicy>);
}
export declare class CacheEntryOptions<K, V> {
    _slidingExpiration?: number;
    _callbacks?: Array<PostEvictionCallback<K, V>>;
    get slidingExpiration(): number | undefined;
    set slidingExpiration(v: number | undefined);
    postEvictionCallback(): Array<PostEvictionCallback<K, V>>;
}
export declare class CacheEntry<K, V> {
    _key: string;
    _value?: V;
    _lastAccess?: number;
    _options?: CacheEntryOptions<K, V>;
    _next?: CacheEntry<K, V>;
    _prev?: CacheEntry<K, V>;
    constructor(key: K, value?: V, options?: CacheEntryOptions<K, V>);
    get key(): string;
    get value(): V | undefined;
    set value(v: V | undefined);
    get slidingExpiration(): number | undefined;
    get expiration(): number;
    postEvictionCallback(): IterableIterator<PostEvictionCallback<K, V>>;
}
export declare class MemoryCache<K, V> {
    _policy: CachePolicy;
    _cache: Map<K, CacheEntry<K, V>>;
    _head?: CacheEntry<K, V>;
    _tail?: CacheEntry<K, V>;
    _count: number;
    _timer?: ReturnType<typeof setTimeout>;
    _gc: () => void;
    constructor(policy?: CachePolicy);
    get(key: K): V | undefined;
    set(key: K, value: V, options?: CacheEntryOptions<K, V>): void;
    keys(): IterableIterator<K>;
    protected gc(): void;
    private sortList;
    private removeNode;
    private insertFirst;
    private insertLast;
    private insertAfter;
    private insertBefore;
}
