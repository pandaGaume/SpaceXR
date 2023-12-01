import { IMemoryCache, MemoryCache } from "../../utils/cache";
import { FetchResult, ITileAddress, TileSection, ITileDatasource, ITileMetrics, IsTileContentView, TileContent } from "../tiles.interfaces";
import { ITileContentProvider, ContentUpdateEventArgs } from "./tiles.interfaces.pipeline";
import { Nullable } from "../../types";
import { Observable, Observer } from "../../events/events.observable";
import { TileContentView } from "../tiles";
import { TileAddress } from "../tiles.address";

export class TileContentProvider<T> implements ITileContentProvider<T> {
    // cache
    private _cache: IMemoryCache<string, TileContent<T>>;
    // data source
    private _datasource: ITileDatasource<T, ITileAddress>;
    // observable
    _contentUpdateObservable?: Observable<ContentUpdateEventArgs<T>>;

    // options to enable/disable transition between levels of details
    _smoothingZomm: boolean;

    public constructor(datasource: ITileDatasource<T, ITileAddress>, cache?: IMemoryCache<string, TileContent<T>>) {
        this._cache = cache || new MemoryCache<string, TileContent<T>>();
        this._datasource = datasource;
        this._smoothingZomm = false;
    }

    public accept(address: ITileAddress): boolean {
        return TileAddress.IsValidAddress(address, this.metrics);
    }

    public get id(): string | undefined {
        return this._datasource.name;
    }

    public get cache(): IMemoryCache<string, TileContent<T>> {
        return this._cache;
    }

    public get datasource(): ITileDatasource<T, ITileAddress> {
        return this._datasource;
    }
    public get metrics(): ITileMetrics {
        return this._datasource.metrics;
    }

    public get contentUpdateObservable(): Observable<ContentUpdateEventArgs<T>> {
        this._contentUpdateObservable = this._contentUpdateObservable || new Observable<ContentUpdateEventArgs<T>>(this.onContentObserverAdded.bind(this));
        return this._contentUpdateObservable!;
    }

    private buildCacheKey(key: string): string {
        return `${this._datasource.name}_${key}`;
    }

    public getTileContent(address: ITileAddress): TileContent<T> {
        const cacheKey = this.buildCacheKey(address.quadkey);

        // first have a look in cache
        if (this._cache.contains(cacheKey)) {
            return this._cache.get(cacheKey)!;
        }

        // then try to build the content using alternative method
        let c = this._smoothingZomm ? this.buildAlternativeTileContent(address) : null;

        // store the content, either null or not. This flag the address as beeing processed.
        this._cache.set(cacheKey, c);

        // then try to get it from the datasource
        this._datasource
            .fetchAsync(address, this) // we pass this as context
            .then((result: FetchResult<Nullable<T>>) => {
                if (result.content) {
                    const provider = <TileContentProvider<T>>result?.userArgs?.[0];
                    if (provider) {
                        const address = result.address;
                        // we have the content of the tile.
                        const content = result.content;
                        // we store the value in cache
                        provider._cache.set(this.buildCacheKey(address.quadkey), content);
                        // we notify the observers
                        if (this._contentUpdateObservable) {
                            const e = new ContentUpdateEventArgs<T>(provider, address, content);
                            this._contentUpdateObservable.notifyObservers(e);
                        }
                    }
                }
            })
            .catch((reason: any) => {
                // the lookup operation has failed - TODO describe a strategy
                console.log(`the lookup operation has failed because of ${reason}`);
            });

        return c;
    }

    protected buildTileContentView(address: ITileAddress, source?: TileSection, target?: TileSection): TileContent<T> | undefined {
        let cacheKey = this.buildCacheKey(TileContentView.BuildKey(address, source, target));
        if (this._cache.contains(cacheKey)) {
            const view = this._cache.get(cacheKey);
            return view;
        }
        const view = new TileContentView(address, source, target);
        this._cache.set(cacheKey, view);
        return view;
    }

    protected buildAlternativeTileContent(address: ITileAddress): TileContent<T> {
        let key = address.quadkey;
        const parentCacheKey = this.buildCacheKey(TileAddress.ToParentKey(key));
        const content = this._cache.get(parentCacheKey);
        if (content) {
            if (IsTileContentView(content)) {
                return null;
            }
            // get the corresponding upper left corner of the parent source tile
            const source = TileAddress.ToNormalizedSection(key);
            if (source) {
                return this.buildTileContentView(address, source) ?? null;
            }
        }

        // try to get the content from the childs
        const childKeys = TileAddress.ToChildsKey(key);
        const targets = childKeys.map((k) => {
            return TileAddress.ToNormalizedSection(k);
        });
        return this.buildTileContentView(address, null, targets) ?? null;
    }

    public dispose(): void {}

    // INTERNALS
    private onContentObserverAdded(observer: Observer<ContentUpdateEventArgs<T>>): void {}
}
