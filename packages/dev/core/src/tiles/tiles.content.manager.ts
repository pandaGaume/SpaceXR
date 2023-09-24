import { IMemoryCache, MemoryCache } from "core/utils/cache";
import { FetchResult, ITileAddress, ITileDatasource } from "./tiles.interfaces";
import { Nullable } from "core/types";
import { Observable, Observer } from "core/events/events.observable";
import { EventArgs } from "core/events/events.args";

export class ContentUpdateEventArgs<T> extends EventArgs<TileContentManager<T>> {
    _address: ITileAddress;
    _content: Nullable<T>;

    public constructor(address: ITileAddress, content: Nullable<T>, sender: TileContentManager<T>) {
        super(sender);
        this._address = address;
        this._content = content;
    }

    public get Address(): ITileAddress {
        return this._address;
    }

    public get Content(): Nullable<T> {
        return this._content;
    }
}

export class TileContentManager<T> {
    // cache
    private _cache: IMemoryCache<string, Nullable<T>>;
    // data source
    private _datasource: ITileDatasource<T, ITileAddress>;
    // observable
    _contentUpdateObservable?: Observable<ContentUpdateEventArgs<T>>;

    public constructor(datasource: ITileDatasource<T, ITileAddress>, cache?: IMemoryCache<string, T>) {
        this._cache = cache || new MemoryCache<string, T>();
        this._datasource = datasource;
    }

    public get Cache(): IMemoryCache<string, Nullable<T>> {
        return this._cache;
    }

    public get Datasource(): ITileDatasource<T, ITileAddress> {
        return this._datasource;
    }

    public get ContentUpdateObservable(): Observable<ContentUpdateEventArgs<T>> {
        this._contentUpdateObservable = this._contentUpdateObservable || new Observable<ContentUpdateEventArgs<T>>(this.onContentObserverAdded.bind(this));
        return this._contentUpdateObservable!;
    }

    public GetTileContent(address: ITileAddress): Nullable<T> | undefined {
        const key = address.quadkey;
        // first have a look in cache
        if (this._cache.contains(key)) {
            return this._cache.get(key);
        }
        // then try to build it using parent or childs
        let t = this._buildTileContent(address);
        // store the content, either null or not. This flag the address as beeing processed.
        this._cache.set(key, t);

        // then try to get it from the datasource
        this._datasource
            .fetchAsync(address, this)
            .then((result: FetchResult<Nullable<T>>) => {
                if (result.content) {
                    const manager = <TileContentManager<T>>result.userArgs[0];
                    const address = <ITileAddress>result.userArgs[1];
                    // we have the content of the tile.
                    const content = result.content;
                    // we store the value in cache
                    manager._cache.set(result.address.quadkey, content);
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

        return null;
    }

    // INTERNALS
    private onContentObserverAdded(observer: Observer<ContentUpdateEventArgs<T>>): void {}

    private _buildTileContent(address: ITileAddress): Nullable<T> {
        return null;
    }
}
