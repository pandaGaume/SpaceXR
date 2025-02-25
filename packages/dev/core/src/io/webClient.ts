import { Scalar } from "../math";
import { IFilter, ICodec } from "../tiles";
import { Nullable } from "../types";

export class FetchError extends Error {
    public readonly userArgs: Array<unknown>;

    public constructor(message: string, ...userArgs: Array<unknown>) {
        super(message);
        this.userArgs = userArgs.length > 0 ? userArgs : [];
    }
}

export class FetchResult<R, T> {
    public static Null<R, T>(request: R, userArgs: Nullable<Array<unknown>> = null): FetchResult<R, Nullable<T>> {
        return new FetchResult<R, Nullable<T>>(request, null, userArgs);
    }

    public readonly address: R;
    public readonly content: T;
    public readonly userArgs: Nullable<Array<unknown>>;

    public ok: boolean = true;
    public status?: number;
    public statusText?: string;

    public constructor(address: R, content: T, userArgs: Nullable<Array<unknown>> = null) {
        this.address = address;
        this.content = content;
        this.userArgs = userArgs ?? [];
    }
}

export interface IUrlBuilder<R> {
    buildUrl(request: R, ...params: unknown[]): string;
}

export class WebClientOptions {
    // Factory function to get properly typed default options
    public static getDefault(): WebClientOptions {
        return new WebClientOptions({
            maxRetry: 3,
            initialDelay: 1000,
        });
    }

    public maxRetry?: number;
    public initialDelay?: number;
    public filter?: IFilter<any>;

    public constructor(p: Partial<WebClientOptions>) {
        Object.assign(this, p);
    }
}

export class WebClientOptionsBuilder {
    private _options: Partial<WebClientOptions> = {};

    public withMaxRetry(v: number): WebClientOptionsBuilder {
        this._options.maxRetry = v;
        return this;
    }

    public withInitialDelay(v: number): WebClientOptionsBuilder {
        this._options.initialDelay = v;
        return this;
    }

    public build(): WebClientOptions {
        return new WebClientOptions(this._options);
    }
}

export class WebClient<R, T> {
    private readonly _name: string;
    private readonly _urlFactory: IUrlBuilder<R>;
    private readonly _codec: ICodec<T>;
    private readonly _options: WebClientOptions;

    public constructor(name: string, urlFactory: IUrlBuilder<R>, codec: ICodec<T>, options?: WebClientOptions) {
        this._name = name;
        if (!urlFactory) {
            throw new Error(`invalid url factory parameter ${codec}`);
        }
        if (!codec) {
            throw new Error(`invalid codec parameter ${codec}`);
        }
        this._urlFactory = urlFactory;
        this._codec = codec;
        this._options = { ...WebClientOptions.getDefault(), ...options };
    }

    public get name(): string {
        return this._name;
    }

    public async fetchAsync(request: R, ...userArgs: Array<unknown>): Promise<FetchResult<R, Nullable<T>>> {
        if (!request) {
            throw new FetchError("Invalid request parameter.");
        }

        const url = this._urlFactory.buildUrl(request, ...userArgs) ?? request.toString();
        if (!url) {
            throw new FetchError(`Builded url of ${request.toString()} can not be null`);
        }

        const maxRetry = this._options.maxRetry ?? 1;
        let delay = this._options.initialDelay ?? 1000;
        let retryCount = 0;

        do {
            try {
                const response: Response = await fetch(url);
                let content: Nullable<T> = null;

                if (response.ok) {
                    content = (await this._codec.decodeAsync(response)) as Nullable<T>;
                } else {
                    console.warn(`Request failed: ${url} (Status: ${response.status})`);
                }

                const result = new FetchResult<R, Nullable<T>>(request, content, userArgs);
                result.status = response.status;
                result.statusText = response.statusText;

                return result;
            } catch (error: any) {
                console.error(`Error fetching ${url}: ${error.message || error}`);

                if (retryCount >= maxRetry - 1) {
                    throw new FetchError(`Exceeded maximum retries for URL: ${url}`, ...userArgs);
                }
            }

            // Retry with exponential backoff + jitter
            const jitter = Scalar.GetRandomInt(0, this._options.initialDelay ?? 1000);
            await new Promise((resolve) => setTimeout(resolve, Math.min(delay + jitter, 30000))); // Cap max delay
            delay *= 2; // Exponential backoff
            retryCount++;
        } while (retryCount < maxRetry);

        throw new FetchError(`Exceeded maximum retries for URL: ${url}`, ...userArgs);
    }
}
