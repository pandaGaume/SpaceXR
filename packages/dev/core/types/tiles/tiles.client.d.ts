import { ITileAddress2, ITileClient, ITileMetrics } from "./tiles.interfaces";
import { Nullable } from "../types";
import { IGeoBounded } from "../geography";
import { FetchResult, IUrlBuilder, WebClient, WebClientOptions } from "../io";
import { ICodec } from "./codecs";
export declare class TileWebClient<T> extends WebClient<ITileAddress2, T> implements ITileClient<T> {
    _metrics: ITileMetrics;
    _zindex: number;
    constructor(name: string, urlFactory: IUrlBuilder<ITileAddress2>, codec: ICodec<T>, metrics: ITileMetrics, options?: WebClientOptions);
    get zindex(): number;
    set zindex(v: number);
    get metrics(): ITileMetrics;
    fetchAsync(request: ITileAddress2, env?: IGeoBounded, ...userArgs: Array<unknown>): Promise<FetchResult<ITileAddress2, Nullable<T>>>;
}
