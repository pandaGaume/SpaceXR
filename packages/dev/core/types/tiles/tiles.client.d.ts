import { ITileAddress, ITileCodec, ITileClient, ITileClientOptions, ITileUrlBuilder } from "./tiles.interfaces";
import { Nullable } from "../types";
export declare class TileClientOptions<T> implements ITileClientOptions<T> {
    urlFactory: ITileUrlBuilder;
    codec: ITileCodec<T>;
    constructor(urlFactory: ITileUrlBuilder, codec: ITileCodec<T>);
}
export declare class TileClientOptionsBuilder<T> {
    _urlFactory?: ITileUrlBuilder;
    _codec?: ITileCodec<T>;
    withUrlFactory(v: ITileUrlBuilder): TileClientOptionsBuilder<T>;
    withCodec(v: ITileCodec<T>): TileClientOptionsBuilder<T>;
    build(): Nullable<TileClientOptions<T>>;
}
export declare class TileClient<T, R extends ITileAddress> implements ITileClient<T, R> {
    protected _o: TileClientOptions<T>;
    constructor(options: TileClientOptions<T>);
    get options(): TileClientOptions<T>;
    set options(value: TileClientOptions<T>);
    fetchAsync(request: ITileAddress): Promise<Awaited<T> | undefined>;
}
