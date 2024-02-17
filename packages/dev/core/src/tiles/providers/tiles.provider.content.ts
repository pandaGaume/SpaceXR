import { IMemoryCache, MemoryCache } from "../../cache/cache";
import { ITile, ITileAddress, ITileContentProvider, ITileDatasource, ITileMetrics, TileContentType } from "../tiles.interfaces";
import { TileAddress } from "../address/tiles.address";

export class TileContentProvider<T> implements ITileContentProvider<T> {
    private _cache: IMemoryCache<string, TileContentType<T>>;
    private _ownCache: boolean;
    private _datasource: ITileDatasource<T, ITileAddress>;
    private _prefix?: string;

    public constructor(datasource: ITileDatasource<T, ITileAddress>, cache?: IMemoryCache<string, TileContentType<T>>) {
        this._datasource = datasource;
        this._cache = cache || new MemoryCache<string, TileContentType<T>>();
        if (cache) {
            this._prefix = this._buildPrefix();
            this._ownCache = false;
        } else {
            this._ownCache = true;
        }
    }

    public accept(address: ITileAddress): boolean {
        return TileAddress.IsValidAddress(address, this.metrics);
    }

    public get name(): string {
        return this._datasource.name;
    }

    public get datasource(): ITileDatasource<T, ITileAddress> {
        return this._datasource;
    }

    public get metrics(): ITileMetrics {
        return this._datasource.metrics;
    }

    public dispose(): void {
        if (this._prefix && !this._ownCache) {
            const p = this._prefix;
            this._cache.clear((k) => k.startsWith(p));
            return;
        }
        this._cache.clear();
    }

    public fetchContent(tile: ITile<T>, callback: (t: ITile<T>) => void): ITile<T> {
        const address = tile.address;
        const cacheKey = this.buildCacheKey(address.quadkey);

        // first have a look in cache
        if (this._cache.contains(cacheKey)) {
            tile.content = this._cache.get(cacheKey)!;
            return tile;
        }

        // then try to build a temporary content using alternative method
        let c = this.buildTemporaryContent(address);

        // store the content, either null or not. This flag the address as beeing processed.
        this._cache.set(cacheKey, c);

        // then try to get it from the datasource
        this._datasource.fetchAsync(address, tile).then(
            (result) => {
                this._cache.set(this.buildCacheKey(address.quadkey), result.content);
                tile.content = result.content;
                callback?.(tile);
            },
            (reason) => {
                console.log(`the fetch operation has failed because of ${reason}`);
            }
        );
        tile.content = c;
        return tile;
    }

    protected buildTemporaryContent(address: ITileAddress): TileContentType<T> {
        // TODO : implement a strategy to build a temporary content. This can be leveraged to display a placeholder during the fetch operation
        // in oder to avoid empty tile to be displayed during pan and zoom operation.
        return null;
    }
    protected buildAlternativContent(address: ITileAddress): TileContentType<T> {
        // TODO : implement a strategy to build an alternativ content
        // this could be used when the datasource is not available or when the lookup operation has failed
        // or when the content is unavailable on purpose such as a 404 error for sea based tile
        return null;
    }

    protected _buildPrefix(): string {
        let p = `${this.name}_${Math.floor(Math.random() * Number.MAX_SAFE_INTEGER)}_`;
        while (this._cache?.any((k) => k.startsWith(p))) {
            p = `${this.name}_${Math.floor(Math.random() * Number.MAX_SAFE_INTEGER)}_`;
        }
        return p;
    }

    private buildCacheKey(key: string): string {
        return this._prefix ? `${key}` : `${this._prefix}${key}`;
    }
}
