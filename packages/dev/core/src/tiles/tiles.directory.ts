import { Tile } from "./tiles";
import { EPSG3857 } from "./tiles.geography";
import { ITile, ITileAddress, ITileBuilder, ITileDatasource, ITileDirectory, ITileMetrics } from "./tiles.interfaces";
import { TileMetrics } from "./tiles.metrics";

type PostEvictionCallback<V> = (e: TileCacheEntry<V>) => void;

class TileCacheEntry<V> {
    _key!: string;
    _value!: ITile<V>;
    _se?: number;
    _lastAccess?: number;
    _callbacks?: Array<PostEvictionCallback<V>>;

    _next?: TileCacheEntry<V>;
    _prev?: TileCacheEntry<V>;

    public constructor(value: ITile<V>) {
        this.value = value;
    }

    public get key(): string {
        return this._key;
    }

    public get value(): ITile<V> {
        this._lastAccess = Date.now();
        return this._value;
    }

    public set value(v: ITile<V>) {
        this._value = v;
        this._key = TileMetrics.TileXYToQuadKey(v.address);
        this._lastAccess = Date.now();
    }

    public get slidingExpiration(): number | undefined {
        return this._se;
    }

    public set slidingExpiration(se: number | undefined) {
        this._se = se;
    }

    public get expiration(): number {
        if (!this._lastAccess || !this._se) {
            return Infinity;
        }
        return this._lastAccess + this._se;
    }

    public addPostEvictionCallback(c: PostEvictionCallback<V>) {
        if (c) {
            this._callbacks = this._callbacks || [];
            this._callbacks.push(c);
        }
    }

    public removeEvictionCallback(c: PostEvictionCallback<V>) {
        if (c && this._callbacks) {
            const i = this._callbacks.indexOf(c);
            if (i >= 0) {
                this._callbacks = this._callbacks.splice(i, 1);
                if (this._callbacks.length == 0) {
                    this._callbacks = undefined;
                }
            }
        }
    }
}

export class CachePolicy {
    slidingExpiration?: number;
    threshold?: number;
    public constructor(init?: Partial<CachePolicy>) {
        Object.assign(this, init);
    }
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

export class TileDirectoryOptionsBuilder<V> {
    _tileBuilder?: ITileBuilder<V>;
    _cacheOptions?: CachePolicy;
    _metrics?: ITileMetrics;

    public withTileBuilder(v: ITileBuilder<V> | undefined): TileDirectoryOptionsBuilder<V> {
        this._tileBuilder = v;
        return this;
    }
    public withCacheOptions(v: CachePolicy | undefined): TileDirectoryOptionsBuilder<V> {
        this._cacheOptions = v;
        return this;
    }
    public withMetrics(v: ITileMetrics | undefined): TileDirectoryOptionsBuilder<V> {
        this._metrics = v;
        return this;
    }

    public build(): TileDirectoryOptions<V> {
        return new TileDirectoryOptions<V>({ tileBuilder: this._tileBuilder, cacheOptions: this._cacheOptions, metrics: this._metrics });
    }
}

export class TileDirectoryOptions<V> {
    public static Default<T>(): TileDirectoryOptions<T> {
        return new TileDirectoryOptionsBuilder<T>()
            .withMetrics(EPSG3857.Shared)
            .withTileBuilder(Tile.Builder())
            .withCacheOptions(new CachePolicyBuilder().withSlidingExpirationFromMinutes(5).withThreshold(500).build())
            .build();
    }

    tileBuilder?: ITileBuilder<V>;
    cacheOptions?: CachePolicy;
    metrics?: ITileMetrics;
    public constructor(init?: Partial<TileDirectoryOptions<V>>) {
        Object.assign(this, init);
    }
}

export class TileDirectory<V> implements ITileDirectory<V> {
    _name: string;
    _datasource: ITileDatasource<V, ITileAddress>;
    _cache: Map<string, TileCacheEntry<V>>;
    _options: TileDirectoryOptions<V>;
    _postEvictionCallback: PostEvictionCallback<V>;

    constructor(name: string, datasource: ITileDatasource<V, ITileAddress>, options?: TileDirectoryOptions<V>) {
        this._name = name;
        this._datasource = datasource;
        this._options = { ...TileDirectoryOptions.Default<V>(), ...options };
        this._cache = new Map<string, TileCacheEntry<V>>();
        this._postEvictionCallback = this.onEntryEvicted.bind(this);
        this._gc = this.gc.bind(this);
    }

    public get name(): string {
        return this._name;
    }

    public get metrics(): ITileMetrics {
        return this._options.metrics || EPSG3857.Shared;
    }

    public lookupAsync(address: ITileAddress): Promise<ITile<V> | undefined> | ITile<V> | undefined {
        const k = address.quadkey || TileMetrics.TileXYToQuadKey(address);
        let e = this._cache.get(k);
        if (e) {
            // return a sync operation
            const t = e?.value; // the underlying code is updating the expiration time.
            this.sortList(e); // sort the list in order to update the expiration timer.
            return t;
        }
        if (this._datasource) {
            return new Promise(async (resolve, reject) => {
                try {
                    const data = await this._datasource.fetchAsync(address);
                    if (data) {
                        const t = this.buildTile(address, data);
                        if (t) {
                            this.bindTile(k, t);
                            e = new TileCacheEntry<V>(t);
                            e.slidingExpiration = this._options.cacheOptions?.slidingExpiration;
                            e.addPostEvictionCallback(this._postEvictionCallback);
                            this._cache.set(e.key, e);
                            this.sortList(e); // sort the list in order to update the expiration timer.
                        }
                        resolve(t);
                    }
                } catch (exception) {
                    console.log("Exception in TileDirectory while fetching for ", address, ":", exception);
                    if (reject) {
                        reject(exception);
                    }
                }
            });
        }
        return undefined;
    }

    protected buildTile(address: ITileAddress, data?: V): ITile<V> {
        const b = this._options.tileBuilder || Tile.Builder<V>();
        return b.withMetrics(this.metrics).withAddress(address).withData(data).build();
    }

    /**
     * Link tile to it's related parent and childs
     * @param key the quadkey of the tile
     * @param t the tile
     */
    protected bindTile(key: string, t: ITile<V>) {
        // looking for parent;
        if (this.metrics.minLOD < t.address.levelOfDetail) {
            const parentKey = TileMetrics.ToParentKey(key);
            t.parent = this._cache.get(parentKey)?.value;
            if (t.parent) {
                t.parent.childrens = t.parent.childrens || [];
                t.parent.childrens.push(t);
            }
        }
        // looking for childrens
        if (this.metrics.maxLOD > t.address.levelOfDetail) {
            const childrens: Array<ITile<V>> = [];
            for (const k of TileMetrics.ToChildKey(key)) {
                const c = this._cache.get(k)?.value;
                if (c) {
                    c.parent = t;
                    childrens.push(c);
                }
            }
            t.childrens = childrens;
        }
    }

    /**
     * Unlink tile to it's related parent and childs
     * @param key the quadkey of the tile
     * @param t the tile
     */
    protected unbindTile(key: string, t: ITile<V>) {
        if (t.parent) {
            const i = t.parent.childrens?.indexOf(t);
            if (i !== undefined && i >= 0) {
                t.parent.childrens = t.parent.childrens?.splice(i, 1);
            }
            t.parent = undefined;
        }
        if (t.childrens) {
            for (const c of t.childrens) {
                c.parent = undefined;
            }
            t.childrens = undefined;
        }
    }

    protected onEntryEvicted(e: TileCacheEntry<V>) {
        this.unbindTile(e.key, e.value);
        e.removeEvictionCallback(this._postEvictionCallback);
    }

    protected gc(): void {
        const now = Date.now();
        const threshold = this._options.cacheOptions?.threshold || 0;

        if (this._head && this._head.expiration <= now) {
            do {
                const tmp = this._head;
                this.removeNode(tmp);
                console.log("Clear", tmp._value.address, "remain", this._count, "tile(s)");
                if (tmp._callbacks) {
                    for (const cb of tmp._callbacks) {
                        cb(tmp);
                    }
                }
            } while (this._head && this._head.expiration - threshold <= now);
        }
        if (this._head) {
            const delay = this._head.expiration - Date.now();
            console.log("timeout after clear", Math.round(delay / 1000), "seconds");
            if (this._timer) {
                clearTimeout(this._timer);
            }
            this._timer = setTimeout(this._gc, delay);
        } else {
            this._timer = undefined;
        }
    }

    // LINKED LIST
    _head?: TileCacheEntry<V>;
    _tail?: TileCacheEntry<V>;
    _count: number = 0;
    _timer?: ReturnType<typeof setTimeout>;
    _gc: () => void;

    private sortList(e: TileCacheEntry<V> | undefined) {
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
                    console.log("Set timeout", Math.round(delay / 1000), "seconds");
                    // we change the trigger.
                    if (this._timer) {
                        clearTimeout(this._timer);
                    }
                    this._timer = setTimeout(this._gc, delay);
                }
            }
        }
    }

    private removeNode(e: TileCacheEntry<V>): void {
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

    private insertFirst(node: TileCacheEntry<V>): void {
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

    private insertLast(node: TileCacheEntry<V>): void {
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

    private insertAfter(node: TileCacheEntry<V>, referenceNode: TileCacheEntry<V>): void {
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

    private insertBefore(node: TileCacheEntry<V>, referenceNode: TileCacheEntry<V>): void {
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
