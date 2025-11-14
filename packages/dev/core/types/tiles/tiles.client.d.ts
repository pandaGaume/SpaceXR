import { ITile2DAddress, ITileClient, ITileMetrics } from "./tiles.interfaces";
import { Nullable } from "../types";
import { IGeoBounded } from "../geography";
import { FetchResult, IUrlBuilder, WebClient, WebClientOptions } from "../io";
import { ICodec } from "./codecs";
export declare class TileWebClient<T> extends WebClient<ITile2DAddress, T> implements ITileClient<T> {
    _metrics: ITileMetrics;
    _zindex: number;
    constructor(name: string, urlFactory: IUrlBuilder<ITile2DAddress>, codec: ICodec<T>, metrics: ITileMetrics, options?: WebClientOptions);
    get zindex(): number;
    set zindex(v: number);
    get metrics(): ITileMetrics;
    fetchAsync(request: ITile2DAddress, env?: IGeoBounded, ...userArgs: Array<unknown>): Promise<FetchResult<ITile2DAddress, Nullable<T>>>;
}
