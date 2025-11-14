import { ITile2DAddress, ITileClient, ITileMetrics } from "./tiles.interfaces";
import { Nullable } from "../types";
import { TileAddress } from "./address/tiles.address";
import { IGeoBounded } from "../geography";
import { FetchError, FetchResult, IUrlBuilder, WebClient, WebClientOptions } from "../io";
import { ICodec } from "./codecs";

export class TileWebClient<T> extends WebClient<ITile2DAddress, T> implements ITileClient<T> {
    _metrics: ITileMetrics;
    _zindex: number;

    public constructor(name: string, urlFactory: IUrlBuilder<ITile2DAddress>, codec: ICodec<T>, metrics: ITileMetrics, options?: WebClientOptions) {
        super(name, codec, urlFactory, options);
        this._metrics = metrics;
        this._zindex = 0;
    }

    public get zindex(): number {
        return this._zindex;
    }

    public set zindex(v: number) {
        this._zindex = v;
    }

    public get metrics(): ITileMetrics {
        return this._metrics;
    }

    public async fetchAsync(request: ITile2DAddress, env?: IGeoBounded, ...userArgs: Array<unknown>): Promise<FetchResult<ITile2DAddress, Nullable<T>>> {
        if (!request) {
            throw new FetchError(`invalid request parameter.`);
        }
        if (TileAddress.IsValidAddress(request, this._metrics) === false) {
            // Do NOT fetch url if address is invalid - return null content
            return FetchResult.Null<ITile2DAddress, T>(request, userArgs);
        }
        return super.fetchAsync(request, env, ...userArgs);
    }
}
