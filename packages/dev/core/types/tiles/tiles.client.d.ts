import { ITileAddress, ITileCodec, ITileClient, ITileUrlBuilder, FetchResult } from "./tiles.interfaces";
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
export declare class TileWebClient<T> implements ITileClient<T> {
    _o: TileWebClientOptions;
    _urlFactory: ITileUrlBuilder;
    _codec: ITileCodec<T>;
    constructor(urlFactory: ITileUrlBuilder, codec: ITileCodec<T>, options?: TileWebClientOptions);
    fetchAsync(request: ITileAddress, ...userArgs: Array<unknown>): Promise<FetchResult<Nullable<T>>>;
}
