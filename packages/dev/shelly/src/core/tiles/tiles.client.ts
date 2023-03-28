import { TileAddress } from "./tiles.address";
import { ITileAddress, ITileCodec, ITileClient, ITileClientOptions, ITileUrlFactory, ITile } from "./tiles.interfaces";
import { Nullable } from "../../types";

export class TileClientOptions<T> implements ITileClientOptions<T> {
    urlFactory: ITileUrlFactory;
    codec: ITileCodec<T>;
    public constructor(urlFactory: ITileUrlFactory, codec: ITileCodec<T>) {
        this.urlFactory = urlFactory;
        this.codec = codec;
    }
}

export class TileClientOptionsBuilder<T> {
    _urlFactory?: ITileUrlFactory;
    _codec?: ITileCodec<T>;

    public withUrlFactory(v: ITileUrlFactory): TileClientOptionsBuilder<T> {
        this._urlFactory = v;
        return this;
    }

    public withCodec(v: ITileCodec<T>): TileClientOptionsBuilder<T> {
        this._codec = v;
        return this;
    }

    public build(): Nullable<TileClientOptions<T>> {
        if (this._urlFactory && this._codec) {
            return new TileClientOptions<T>(this._urlFactory, this._codec);
        }
        return null;
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

    public async fetchAsync(request: ITileAddress): Promise<Nullable<Awaited<ITile<T>>>> {
        const url = this._o.urlFactory.buildUrl(request);
        const response = await fetch(url);
        if (!response || !response.ok) {
            return null;
        }
        const value = await this._o.codec.decode.call(this, response);
        if (value) {
            value.address = new TileAddress(request.x, request.y, request.levelOfDetail);
        }
        return value;
    }
}
