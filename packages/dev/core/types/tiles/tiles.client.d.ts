import { ITileAddress, ITileCodec, ITileClient, ITileClientOptions, ITileUrlFactory } from "./tiles.interfaces";
import { Nullable } from "../types";
export declare class TileClientOptions<T> implements ITileClientOptions<T> {
    urlFactory: ITileUrlFactory;
    codec: ITileCodec<T>;
    constructor(urlFactory: ITileUrlFactory, codec: ITileCodec<T>);
}
export declare class TileClientOptionsBuilder<T> {
    _urlFactory?: ITileUrlFactory;
    _codec?: ITileCodec<T>;
    withUrlFactory(v: ITileUrlFactory): TileClientOptionsBuilder<T>;
    withCodec(v: ITileCodec<T>): TileClientOptionsBuilder<T>;
    build(): Nullable<TileClientOptions<T>>;
}
export declare class TileClient<T, R extends ITileAddress> implements ITileClient<T, R> {
    protected _o: TileClientOptions<T>;
    constructor(options: TileClientOptions<T>);
    get options(): TileClientOptions<T>;
    set options(value: TileClientOptions<T>);
    fetchAsync(request: ITileAddress): Promise<Nullable<Awaited<T>>>;
}
