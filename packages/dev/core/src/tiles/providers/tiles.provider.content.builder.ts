import { IMemoryCache } from "../../cache";
import { ITileAddress, ITileContentProvider, ITileContentProviderBuilder, ITileDatasource, TileContentType } from "../tiles.interfaces";
import { TileContentProvider } from "./tiles.provider.content";

export class TileContentProviderBuilder<T> implements ITileContentProviderBuilder<T> {
    _datasource?: ITileDatasource<T, ITileAddress>;
    _cache?: IMemoryCache<string, TileContentType<T>>;

    public withDatasource(datasource: ITileDatasource<T, ITileAddress>): ITileContentProviderBuilder<T> {
        this._datasource = datasource;
        return this;
    }

    public withCache(cache: IMemoryCache<string, TileContentType<T>>): ITileContentProviderBuilder<T> {
        this._cache = cache;
        return this;
    }

    public build(): ITileContentProvider<T> {
        if (!this._datasource) {
            throw new Error("datasource is required");
        }
        return new TileContentProvider<T>(this._datasource, this._cache);
    }
}
