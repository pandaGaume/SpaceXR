import { ITileAddress, ITileCodec, ITileClient, ITileUrlBuilder, FetchResult, ITileMetrics } from "./tiles.interfaces";
import { Nullable } from "../types";
export declare class TileWebClientOptions {
    static Default: TileWebClientOptions;
    maxRetry?: number;
    initialDelay?: number;
    constructor(p: Partial<TileWebClientOptions>);
}
export declare class TileWebClientOptionsBuilder {
    _maxRetry?: number;
    _initialDelay?: number;
    withMaxRetry(v: number): TileWebClientOptionsBuilder;
    withInitialDelay(v: number): TileWebClientOptionsBuilder;
    build(): TileWebClientOptions;
}
export declare class FetchError extends Error {
    userArgs?: Array<unknown>;
    constructor(message?: string, ...userArgs: Array<unknown>);
}
export declare class TileWebClient<T> implements ITileClient<T> {
    _name: string;
    _o: TileWebClientOptions;
    _urlFactory: ITileUrlBuilder;
    _codec: ITileCodec<T>;
    _metrics: ITileMetrics;
    constructor(name: string, urlFactory: ITileUrlBuilder, codec: ITileCodec<T>, metrics: ITileMetrics, options?: TileWebClientOptions);
    get name(): string;
    get metrics(): ITileMetrics;
    fetchAsync(request: ITileAddress, ...userArgs: Array<unknown>): Promise<FetchResult<Nullable<T>>>;
}
