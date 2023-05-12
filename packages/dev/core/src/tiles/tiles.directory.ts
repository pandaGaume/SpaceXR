import { CacheEntry, CacheEntryOptions, CachePolicy, CachePolicyBuilder, MemoryCache, PostEvictionCallback } from "../utils/cache";
import { Tile } from "./tiles";
import { EPSG3857 } from "./tiles.geography";
import { ITile, ITileAddress, ITileBuilder, ITileDatasource, ITileDirectory, ITileMetrics } from "./tiles.interfaces";
import { TileMetrics } from "./tiles.metrics";

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

export class TileDirectory<V> implements ITileDirectory<ITile<V>> {
    _name: string;
    _datasource: ITileDatasource<V, ITileAddress>;
    _cache: MemoryCache<string, ITile<V>>;
    _options: TileDirectoryOptions<V>;
    _postEvictionCallback: PostEvictionCallback<string, ITile<V>>;

    constructor(name: string, datasource: ITileDatasource<V, ITileAddress>, options?: TileDirectoryOptions<V>) {
        this._name = name;
        this._datasource = datasource;
        this._options = { ...TileDirectoryOptions.Default<V>(), ...options };
        this._cache = new MemoryCache<string, ITile<V>>(this._options.cacheOptions);
        this._postEvictionCallback = this.onEntryEvicted.bind(this);
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
            return e;
        }
        if (this._datasource) {
            return new Promise(async (resolve, reject) => {
                try {
                    const data = await this._datasource.fetchAsync(address);
                    if (data) {
                        const t = this.buildTile(address, data);
                        if (t) {
                            this.bindTile(k, t);
                            const o = new CacheEntryOptions<string, ITile<V>>();
                            o.postEvictionCallback().push(this._postEvictionCallback);
                            this._cache.set(k, t, o);
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
            t.parent = this._cache.get(parentKey);
            if (t.parent) {
                t.parent.childrens = t.parent.childrens || [];
                t.parent.childrens.push(t);
            }
        }
        // looking for childrens
        if (this.metrics.maxLOD > t.address.levelOfDetail) {
            const childrens: Array<ITile<V>> = [];
            for (const k of TileMetrics.ToChildKey(key)) {
                const c = this._cache.get(k);
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
    protected unbindTile(key: string, t: ITile<V> | undefined) {
        if (t?.parent) {
            const i = t.parent.childrens?.indexOf(t);
            if (i !== undefined && i >= 0) {
                t.parent.childrens = t.parent.childrens?.splice(i, 1);
            }
            t.parent = undefined;
        }
        if (t?.childrens) {
            for (const c of t.childrens) {
                c.parent = undefined;
            }
            t.childrens = undefined;
        }
    }

    protected onEntryEvicted(e: CacheEntry<string, ITile<V>>) {
        this.unbindTile(e.key, e.value);
    }
}
