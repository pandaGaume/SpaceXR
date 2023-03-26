import { ITileAddress, ITileCodec, ITileClient, ITileClientOptions, ITileUrlFactory } from "./tiles.interfaces";

export class TileClientOptions<T> implements ITileClientOptions<T> {
    urlFactory: ITileUrlFactory;
    codec: ITileCodec<T>;
    public constructor(urlFactory: ITileUrlFactory, codec: ITileCodec<T>) {
        this.urlFactory = urlFactory;
        this.codec = codec;
    }
}

export class TileClient<T, R extends ITileAddress> implements ITileClient<T, R> {
    protected _o: TileClientOptions<T>;

    public constructor(options: TileClientOptions<T>) {
        this._o = options;
    }

    public get options(): TileClientOptions<T> {
        return this._o;
    }

    public set options(value: TileClientOptions<T>) {
        this._o = value;
    }

    public async fetchAsync(request: ITileAddress): Promise<Awaited<T> | null> {
        const url = this._o.urlFactory.buildUrl(request);
        const response = await fetch(url);
        if (!response || !response.ok) {
            return null;
        }
        const value = await this._o.codec.bind(this)(response);
        return value;
    }
}
