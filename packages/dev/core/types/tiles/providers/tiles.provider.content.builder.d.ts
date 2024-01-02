import { IMemoryCache } from "core/cache";
import { ITileAddress, ITileContentProvider, ITileContentProviderBuilder, ITileDatasource, ITileMetrics, TileContent } from "../tiles.interfaces";
export declare class TileProviderContentBuilder<T> implements ITileContentProviderBuilder<T> {
    _datasource?: ITileDatasource<T, ITileAddress>;
    _cache?: IMemoryCache<string, TileContent<T>>;
    _metrics?: ITileMetrics;
    withDatasource(datasource: ITileDatasource<T, ITileAddress>): ITileContentProviderBuilder<T>;
    withCache(cache: IMemoryCache<string, TileContent<T>>): ITileContentProviderBuilder<T>;
    withMetrics(metrics: ITileMetrics): ITileContentProviderBuilder<T>;
    build(): ITileContentProvider<T>;
}
