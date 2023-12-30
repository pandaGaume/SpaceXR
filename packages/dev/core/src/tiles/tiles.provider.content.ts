import { IMemoryCache, MemoryCache } from "../utils/cache";
import { ITileAddress, ITileContentProvider, ITileDatasource, ITileMetrics, TileContent } from "./tiles.interfaces";
import { Nullable } from "../types";
import { TileAddress } from "./tiles.address";

export class TileContentProvider<T> implements ITileContentProvider<T> {
    private _cache: IMemoryCache<string, TileContent<T>>;
    private _ownCache: boolean;
    private _datasource: ITileDatasource<T, ITileAddress>;
    private _prefix?: string;

    public constructor(datasource: ITileDatasource<T, ITileAddress>, cache?: IMemoryCache<string, TileContent<T>>) {
        this._datasource = datasource;
        this._cache = cache || new MemoryCache<string, TileContent<T>>();
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

    public get zindex(): number {
        return this._datasource.zindex;
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

    public async fetchContentAsync(address: ITileAddress, ...userArgs: Array<unknown>): Promise<Nullable<TileContent<T>>> {
        const cacheKey = this.buildCacheKey(address.quadkey);

        // first have a look in cache
        if (this._cache.contains(cacheKey)) {
            return this._cache.get(cacheKey)!;
        }

        // then try to build a temporary content using alternative method
        let c = this.buildTemporaryContent(address);

        // store the content, either null or not. This flag the address as beeing processed.
        this._cache.set(cacheKey, c);

        // then try to get it from the datasource
        try {
            const result = await this._datasource.fetchAsync(address);
            if (result.content) {
                const provider = <TileContentProvider<T>>result?.userArgs?.[0];
                if (provider) {
                    const address = result.address;
                    // we have the content of the tile.
                    const content = result.content;
                    // we store the value in cache
                    provider._cache.set(this.buildCacheKey(address.quadkey), content);
                }
            }
        } catch (reason: any) {
            // the lookup operation has failed - TODO describe a strategy
            console.log(`the lookup operation has failed because of ${reason}`);
            return this.buildAlternativContent(address);
        }
        return c;
    }

    protected buildTemporaryContent(address: ITileAddress): TileContent<T> {
        // TODO : implement a strategy to build a temporary content. This can be leveraged to display a placeholder during the fetch operation
        // in oder to avoid empty tile to be displayed during pan and zoom operation.
        return null;
    }
    protected buildAlternativContent(address: ITileAddress): TileContent<T> {
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
