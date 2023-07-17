import { ITileAddress, ITileCodec, ITileClient, ITileUrlBuilder, FetchResult, ITileMetrics } from "./tiles.interfaces";
import { Nullable } from "../types";
import { Scalar } from "../math/math";

export class TileWebClientOptions {
    public static Default = new TileWebClientOptions({ maxRetry: 3, initialDelay: 1000 });
    maxRetry?: number;
    initialDelay?: number;

    public constructor(p: Partial<TileWebClientOptions>) {
        Object.assign(this, p);
    }
}

export class TileWebClientOptionsBuilder {
    _maxRetry?: number;
    _initialDelay?: number;

    public withMaxRetry(v: number): TileWebClientOptionsBuilder {
        this._maxRetry = v;
        return this;
    }
    public withInitialDelay(v: number): TileWebClientOptionsBuilder {
        this._initialDelay = v;
        return this;
    }

    public build(): TileWebClientOptions {
        return new TileWebClientOptions({ maxRetry: this._maxRetry, initialDelay: this._initialDelay });
    }
}

export class TileWebClient<T> implements ITileClient<T> {
    _o: TileWebClientOptions;
    _urlFactory: ITileUrlBuilder;
    _codec: ITileCodec<T>;
    _metrics: ITileMetrics;

    public constructor(urlFactory: ITileUrlBuilder, codec: ITileCodec<T>, metrics: ITileMetrics, options?: TileWebClientOptions) {
        if (!urlFactory) {
            throw new Error(`invalid url factory parameter ${urlFactory}`);
        }
        if (!codec) {
            throw new Error(`invalid codec parameter ${codec}`);
        }
        this._urlFactory = urlFactory;
        this._codec = codec;
        this._metrics = metrics;
        this._o = { ...TileWebClientOptions.Default, ...options };
    }

    public get metrics(): ITileMetrics {
        return this._metrics;
    }

    public async fetchAsync(request: ITileAddress, ...userArgs: Array<unknown>): Promise<FetchResult<Nullable<T>>> {
        if (!request) {
            throw new Error(`invalid request parameter ${request}`);
        }
        const url = this._urlFactory.buildUrl(request, ...userArgs);
        if (!url) {
            throw new Error(`Builded url of ${request.toString()} can not be null`);
        }

        const maxRetry = this._o.maxRetry || 1;
        let delay = this._o.initialDelay || 1000;
        let retryCount = 0;
        do {
            try {
                const response = await fetch(url);
                let content = null;
                if (response.ok) {
                    content = await this._codec.decodeAsync(response);
                }
                const r = new FetchResult<Nullable<T>>(request, content, userArgs);
                r.status = response.status;
                r.statusText = response.statusText;
                return r;
            } catch (error: any) {
                // Handle the error here. We have ONLY error.message and error.name
            }
            // Retry after delay using exponential backoff
            const jitter = Scalar.GetRandomInt(0, this._o.initialDelay || 1000); // Random number between 0 and 1000 (milliseconds)
            await new Promise((resolve) => setTimeout(resolve, delay + jitter));
            delay *= 2; // simple Exponential backoff: double the delay for each retry
            retryCount++;
        } while (retryCount < maxRetry);

        throw new Error(`Exceeded maximum retries for URL: ${url}`);
    }
}
