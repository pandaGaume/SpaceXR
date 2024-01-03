import { IMemoryCache } from "core/cache";
import { ITileAddress, ITileContentProvider, ITileContentProviderBuilder, ITileDatasource, TileContent } from "../tiles.interfaces";
export declare class TileContentProviderBuilder<T> implements ITileContentProviderBuilder<T> {
    _datasource?: ITileDatasource<T, ITileAddress>;
    _cache?: IMemoryCache<string, TileContent<T>>;
    withDatasource(datasource: ITileDatasource<T, ITileAddress>): ITileContentProviderBuilder<T>;
    withCache(cache: IMemoryCache<string, TileContent<T>>): ITileContentProviderBuilder<T>;
    build(): ITileContentProvider<T>;
}
