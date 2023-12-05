import { IDisposable } from "..";

export enum EvictionReason {
    user,
    expired,
}

export type PostEvictionCallback<K, V> = (e: CacheEntry<K, V>, reason: EvictionReason) => void;

export interface IMemoryCache<K, V> extends IDisposable {
    contains(key: K): boolean;
    get(key: K): V | undefined;
    set(key: K, value: V, options?: CacheEntryOptions<K, V>): void;
    delete(key: K): void;
    keys(): IterableIterator<K>;
    clear(predicate?: (k: K) => boolean): void;
}

export class CachePolicyBuilder {
    _slidingExpiration?: number;
    _threshold?: number;

    public withSlidingExpiration(slidingExpiration: number | undefined): CachePolicyBuilder {
        this._slidingExpiration = slidingExpiration;
        return this;
    }
    public withSlidingExpirationFromMinutes(slidingExpiration: number | undefined): CachePolicyBuilder {
        this._slidingExpiration = slidingExpiration ? slidingExpiration * 60000 : slidingExpiration;
        return this;
    }
    public withSlidingExpirationFromSeconds(slidingExpiration: number | undefined): CachePolicyBuilder {
        this._slidingExpiration = slidingExpiration ? slidingExpiration * 1000 : slidingExpiration;
        return this;
    }
    public withThreshold(threshold: number | undefined): CachePolicyBuilder {
        this._threshold = threshold;
        return this;
    }

    public build(): CachePolicy {
        return new CachePolicy({ slidingExpiration: this._slidingExpiration, threshold: this._threshold });
    }
}

export class CachePolicy {
    public static Default = new CachePolicyBuilder().withSlidingExpirationFromMinutes(5).withThreshold(100).build();

    public slidingExpiration?: number;
    public threshold?: number;

    public constructor(init?: Partial<CachePolicy>) {
        Object.assign(this, init);
    }
}

export class CacheEntryOptions<K, V> {
    _slidingExpiration?: number;
    _callbacks?: Array<PostEvictionCallback<K, V>>;

    public constructor(init?: Partial<CacheEntryOptions<K, V>>) {
        Object.assign(this, init);
    }
    public get slidingExpiration(): number | undefined {
        return this._slidingExpiration;
    }

    public set slidingExpiration(v: number | undefined) {
        this._slidingExpiration = v;
    }

    public get postEvictionCallback(): Array<PostEvictionCallback<K, V>> {
        return (this._callbacks = this._callbacks || []);
    }
    public set postEvictionCallback(a: Array<PostEvictionCallback<K, V>>) {
        this._callbacks = a;
    }
}

export class CacheEntryOptionsBuilder<K, V> {
    _slidingExpiration?: number;
    _callbacks?: Array<PostEvictionCallback<K, V>>;

    public withSlidingExpiration(slidingExpiration: number | undefined): CacheEntryOptionsBuilder<K, V> {
        this._slidingExpiration = slidingExpiration;
        return this;
    }
    public withSlidingExpirationFromMinutes(slidingExpiration: number | undefined): CacheEntryOptionsBuilder<K, V> {
        this._slidingExpiration = slidingExpiration ? slidingExpiration * 60000 : slidingExpiration;
        return this;
    }
    public withSlidingExpirationFromSeconds(slidingExpiration: number | undefined): CacheEntryOptionsBuilder<K, V> {
        this._slidingExpiration = slidingExpiration ? slidingExpiration * 1000 : slidingExpiration;
        return this;
    }
    public withPostEvictionCallbacks(..._callbacks: PostEvictionCallback<K, V>[]): CacheEntryOptionsBuilder<K, V> {
        this._callbacks = this._callbacks || [];
        this._callbacks.push(..._callbacks);
        return this;
    }

    public build(): CacheEntryOptions<K, V> {
        return new CacheEntryOptions({ slidingExpiration: this._slidingExpiration, postEvictionCallback: this._callbacks });
    }
}

export class CacheEntry<K, V> {
    _key!: K;
    _value?: V;
    _lastAccess?: number;
    _options?: CacheEntryOptions<K, V>;

    _next?: CacheEntry<K, V>;
    _prev?: CacheEntry<K, V>;

    public constructor(key: K, value?: V, options?: CacheEntryOptions<K, V>) {
        this._options = options;
        this._value = value;
        this._lastAccess = Date.now();
    }

    public get key(): K {
        return this._key;
    }

    public get value(): V | undefined {
        this._lastAccess = Date.now();
        return this._value;
    }

    public set value(v: V | undefined) {
        this._lastAccess = Date.now();
        this._value = v;
    }

    public get expiration(): number {
        const se = this._options?._slidingExpiration;
        if (!this._lastAccess || !se) {
            return Infinity;
        }
        return this._lastAccess + se;
    }

    public *postEvictionCallback(): IterableIterator<PostEvictionCallback<K, V>> {
        return this._options?._callbacks;
    }
}

export class MemoryCache<K, V> implements IMemoryCache<K, V> {
    _policy: CachePolicy;
    _cache: Map<K, CacheEntry<K, V>>;

    _head?: CacheEntry<K, V>;
    _tail?: CacheEntry<K, V>;
    _count: number = 0;
    _timer?: ReturnType<typeof setTimeout>;
    _gc: () => void;

    public constructor(policy?: CachePolicy) {
        this._policy = { ...CachePolicy.Default, ...policy };
        this._cache = new Map<K, CacheEntry<K, V>>();
        this._gc = this.gc.bind(this);
    }

    public contains(key: K): boolean {
        return this._cache.has(key);
    }

    public get(key: K): V | undefined {
        const e = this._cache.get(key);
        if (e) {
            const v = e.value;
            this.sortList(e);
            return v;
        }
        return undefined;
    }

    public set(key: K, value: V, options?: CacheEntryOptions<K, V>): void {
        const o = <CacheEntryOptions<K, V>>{ ...{ slidingExpiration: this._policy.slidingExpiration }, ...options };
        let e = this._cache.get(key);
        if (!e) {
            e = new CacheEntry(key, value, o);
            this._cache.set(key, e);
        } else {
            e.value = value;
        }
        this.sortList(e);
        return;
    }

    public delete(key: K): void {
        const e = this._cache.get(key);
        if (e) {
            const isHead = e === this._head;
            this.removeNode(e);
            this._cache.delete(key);
            for (const cb of e.postEvictionCallback()) {
                cb(e, EvictionReason.user);
            }
            if (isHead) {
                this.updateTimer();
            }
        }
    }

    public keys(): IterableIterator<K> {
        return this._cache.keys();
    }

    public clear(predicate?: (k: K) => boolean): void {
        const keys = [...this._cache.keys()];
        for (const k of keys) {
            if (predicate && predicate(k)) {
                this.delete(k);
            }
        }
    }

    public dispose(): void {
        if (this._timer) {
            clearTimeout(this._timer);
            this._timer = undefined;
        }
        this.clear();
    }

    protected gc(): void {
        const now = Date.now();
        const threshold = this._policy.threshold || 0;

        if (this._head && this._head.expiration <= now) {
            do {
                const tmp = this._head;
                this.removeNode(tmp);
                this._cache.delete(tmp.key);
                for (const cb of tmp.postEvictionCallback()) {
                    cb(tmp, EvictionReason.expired);
                }
            } while (this._head && this._head.expiration - threshold <= now);
        }
        this.updateTimer();
    }

    private updateTimer() {
        if (this._head) {
            const delay = this._head.expiration - Date.now();
            //console.log("timeout after clear", Math.round(delay / 1000), "seconds, remains", this._count, "tile(s)");
            if (this._timer) {
                clearTimeout(this._timer);
            }
            this._timer = setTimeout(this._gc, delay);
        } else {
            this._timer = undefined;
        }
    }

    // LINKED LIST

    private sortList(e: CacheEntry<K, V> | undefined) {
        if (e) {
            const head = this._head;

            try {
                if (!e._next && !e._prev) {
                    this.insertLast(e);
                }

                // then sort e as bubble up or down
                const value = e.expiration;
                let n = e._prev;
                if (n && n.expiration > value) {
                    this.removeNode(e);
                    // up
                    do {
                        n = n._prev;
                    } while (n && n.expiration > value);
                    if (n) {
                        this.insertAfter(e, n);
                        return;
                    }
                    this.insertFirst(e);
                    return;
                }

                n = e._next;
                if (n && n.expiration < value) {
                    this.removeNode(e);
                    // down
                    do {
                        n = n._next;
                    } while (n && n.expiration < value);
                    if (n) {
                        this.insertBefore(e, n);
                    } else {
                        this.insertLast(e);
                    }
                }
            } finally {
                if (this._head && this._head !== head) {
                    const delay = this._head.expiration - Date.now();
                    // we change the trigger.
                    if (this._timer) {
                        clearTimeout(this._timer);
                    }
                    this._timer = setTimeout(this._gc, delay);
                }
            }
        }
    }

    private removeNode(e: CacheEntry<K, V>): void {
        if (e._next) {
            e._next._prev = e._prev;
        }
        if (e._prev) {
            e._prev._next = e._next;
        }
        if (this._head === e) {
            this._head = e._next;
        }

        if (this._tail === e) {
            this._tail = e._prev;
        }
        e._next = e._prev = undefined;
        this._count--;
    }

    private insertFirst(node: CacheEntry<K, V>): void {
        if (!this._tail) {
            this._tail = node;
        }
        if (this._head) {
            this._head._prev = node;
            node._next = this._head;
        }
        this._head = node;
        this._count++;
    }

    private insertLast(node: CacheEntry<K, V>): void {
        if (!this._head) {
            this._head = node;
        }
        if (this._tail) {
            this._tail._next = node;
            node._prev = this._tail;
        }
        this._tail = node;
        this._count++;
    }

    private insertAfter(node: CacheEntry<K, V>, referenceNode: CacheEntry<K, V>): void {
        if (!referenceNode._next) {
            this._tail = node;
        }
        if (referenceNode._next) {
            referenceNode._next._prev = node;
            node._next = referenceNode._next;
        }
        referenceNode._next = node;
        node._prev = referenceNode;
        this._count++;
    }

    private insertBefore(node: CacheEntry<K, V>, referenceNode: CacheEntry<K, V>): void {
        if (!referenceNode._prev) {
            this._head = node;
        }
        if (referenceNode._prev) {
            referenceNode._prev._next = node;
            node._prev = referenceNode._prev;
        }
        referenceNode._prev = node;
        node._next = referenceNode;
        this._count++;
    }
}
