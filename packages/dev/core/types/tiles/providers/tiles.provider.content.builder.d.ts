import { IMemoryCache } from "../../cache";
import { ITileAddress, ITileContentProvider, ITileContentProviderBuilder, ITileDatasource, TileContentType } from "../tiles.interfaces";
export declare class TileContentProviderBuilder<T> implements ITileContentProviderBuilder<T> {
    _datasource?: ITileDatasource<T, ITileAddress>;
    _cache?: IMemoryCache<string, TileContentType<T>>;
    withDatasource(datasource: ITileDatasource<T, ITileAddress>): ITileContentProviderBuilder<T>;
    withCache(cache: IMemoryCache<string, TileContentType<T>>): ITileContentProviderBuilder<T>;
    build(): ITileContentProvider<T>;
}
