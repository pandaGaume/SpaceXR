import { IMemoryCache, MemoryCache } from "core/utils/cache";
import { FetchResult, ITileAddress, ITileDatasource, ITileMetrics, TileContent } from "./tiles.interfaces";
import { Nullable } from "core/types";
import { Observable, Observer } from "core/events/events.observable";
import { EventArgs } from "core/events/events.args";

export class ContentUpdateEventArgs<T> extends EventArgs<TileContentManager<T>> {
    _address: ITileAddress;
    _content: TileContent<T>;

    public constructor(address: ITileAddress, content: TileContent<T>, sender: TileContentManager<T>) {
        super(sender);
        this._address = address;
        this._content = content;
    }

    public get address(): ITileAddress {
        return this._address;
    }

    public get content(): TileContent<T> {
        return this._content;
    }
}

export class TileContentManager<T> {
    // cache
    private _cache: IMemoryCache<string, TileContent<T>>;
    // data source
    private _datasource: ITileDatasource<T, ITileAddress>;
    // observable
    _contentUpdateObservable?: Observable<ContentUpdateEventArgs<T>>;

    public constructor(datasource: ITileDatasource<T, ITileAddress>, cache?: IMemoryCache<string, TileContent<T>>) {
        this._cache = cache || new MemoryCache<string, TileContent<T>>();
        this._datasource = datasource;
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

    public getTileContent(address: ITileAddress): TileContent<T> {
        const key = address.quadkey;
        // first have a look in cache
        if (this._cache.contains(key)) {
            return this._cache.get(key)!;
        }
        // then try to build the content using alternative method
        let c = this.buildAlternativeTileContent(address);

        // store the content, either null or not. This flag the address as beeing processed.
        this._cache.set(key, c);

        // then try to get it from the datasource
        this._datasource
            .fetchAsync(address, this)
            .then((result: FetchResult<Nullable<T>>) => {
                if (result.content) {
                    const manager = <TileContentManager<T>>result.userArgs[0];
                    const address = result.address;
                    // we have the content of the tile.
                    const content = [result.content];
                    // we store the value in cache
                    manager._cache.set(address.quadkey, content);
                    // we notify the observers
                    if (this._contentUpdateObservable) {
                        const e = new ContentUpdateEventArgs<T>(address, content, manager);
                        this._contentUpdateObservable.notifyObservers(e);
                    }
                }
            })
            .catch((reason: any) => {
                // the lookup operation has failed - TODO describe a strategy
                console.log(`the lookup operation has failed because of ${reason}`);
            });

        return c;
    }

    protected buildAlternativeTileContent(address: ITileAddress): TileContent<T> {
        return null;
    }

    // INTERNALS
    private onContentObserverAdded(observer: Observer<ContentUpdateEventArgs<T>>): void {}
}
