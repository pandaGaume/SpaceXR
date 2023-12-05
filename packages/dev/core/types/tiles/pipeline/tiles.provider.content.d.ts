import { IMemoryCache } from "../../utils/cache";
import { ITileAddress, ITileDatasource, ITileMetrics, TileContent } from "../tiles.interfaces";
import { ITileContentProvider } from "./tiles.pipeline.interfaces";
import { Nullable } from "../../types";
export interface ITileContentProviderOptions<T> {
    datasource: ITileDatasource<T, ITileAddress>;
    cache?: IMemoryCache<string, TileContent<T>>;
}
export declare class TileContentProvider<T> implements ITileContentProvider<T> {
    private _name;
    private _cache;
    private _ownCache;
    private _datasource;
    constructor(name: string, options: ITileContentProviderOptions<T>);
    accept(address: ITileAddress): boolean;
    get name(): string;
    get datasource(): ITileDatasource<T, ITileAddress>;
    get metrics(): ITileMetrics;
    private get prefix();
    private buildCacheKey;
    fetchContentAsync(address: ITileAddress, ...userArgs: Array<unknown>): Promise<Nullable<TileContent<T>>>;
    protected buildTemporaryContent(address: ITileAddress): TileContent<T>;
    protected buildAlternativContent(address: ITileAddress): TileContent<T>;
    dispose(): void;
}
