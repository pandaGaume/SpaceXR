import { IDisposable } from "..";
export declare enum EvictionReason {
    user = 0,
    expired = 1
}
export type PostEvictionCallback<K, V> = (e: CacheEntry<K, V>, reason: EvictionReason) => void;
export interface IMemoryCache<K, V> extends IDisposable {
    contains(key: K): boolean;
    get(key: K): V | undefined;
    set(key: K, value: V, options?: CacheEntryOptions<K, V>): void;
    delete(key: K): void;
    keys(): IterableIterator<K>;
    clear(predicate?: (k: K) => boolean): void;
    any(predicate?: (k: K) => boolean): boolean;
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
export declare class CachePolicy {
    static Default: CachePolicy;
    slidingExpiration?: number;
    threshold?: number;
    constructor(init?: Partial<CachePolicy>);
}
export declare class CacheEntryOptions<K, V> {
    _slidingExpiration?: number;
    _callbacks?: Array<PostEvictionCallback<K, V>>;
    constructor(init?: Partial<CacheEntryOptions<K, V>>);
    get slidingExpiration(): number | undefined;
    set slidingExpiration(v: number | undefined);
    get postEvictionCallback(): Array<PostEvictionCallback<K, V>>;
    set postEvictionCallback(a: Array<PostEvictionCallback<K, V>>);
}
export declare class CacheEntryOptionsBuilder<K, V> {
    _slidingExpiration?: number;
    _callbacks?: Array<PostEvictionCallback<K, V>>;
    withSlidingExpiration(slidingExpiration: number | undefined): CacheEntryOptionsBuilder<K, V>;
    withSlidingExpirationFromMinutes(slidingExpiration: number | undefined): CacheEntryOptionsBuilder<K, V>;
    withSlidingExpirationFromSeconds(slidingExpiration: number | undefined): CacheEntryOptionsBuilder<K, V>;
    withPostEvictionCallbacks(..._callbacks: PostEvictionCallback<K, V>[]): CacheEntryOptionsBuilder<K, V>;
    build(): CacheEntryOptions<K, V>;
}
export declare class CacheEntry<K, V> {
    _key: K;
    _value?: V;
    _lastAccess?: number;
    _options?: CacheEntryOptions<K, V>;
    _next?: CacheEntry<K, V>;
    _prev?: CacheEntry<K, V>;
    constructor(key: K, value?: V, options?: CacheEntryOptions<K, V>);
    get key(): K;
    get value(): V | undefined;
    set value(v: V | undefined);
    get expiration(): number;
    postEvictionCallback(): IterableIterator<PostEvictionCallback<K, V>>;
}
export declare class MemoryCache<K, V> implements IMemoryCache<K, V> {
    _policy: CachePolicy;
    _cache: Map<K, CacheEntry<K, V>>;
    _head?: CacheEntry<K, V>;
    _tail?: CacheEntry<K, V>;
    _count: number;
    _timer?: ReturnType<typeof setTimeout>;
    _gc: () => void;
    constructor(policy?: CachePolicy);
    contains(key: K): boolean;
    get(key: K): V | undefined;
    set(key: K, value: V, options?: CacheEntryOptions<K, V>): void;
    delete(key: K): void;
    keys(): IterableIterator<K>;
    clear(predicate?: (k: K) => boolean): void;
    any(predicate?: (k: K) => boolean): boolean;
    dispose(): void;
    protected gc(): void;
    private updateTimer;
    private sortList;
    private removeNode;
    private insertFirst;
    private insertLast;
    private insertAfter;
    private insertBefore;
}
