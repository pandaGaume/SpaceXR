import { ITile2DAddress, ITileClient, ITileMetrics } from "./tiles.interfaces";
import { Nullable } from "../types";
import { TileAddress } from "./address/tiles.address";
import { IGeoBounded } from "../geography";
import { FetchError, FetchResult, IUrlBuilder, WebClientOptions } from "../io";

/**
 * A tile client that loads image tiles via <img> elements instead of fetch().
 * This bypasses CORS restrictions, allowing tiles to be loaded from servers
 * that do not send Access-Control-Allow-Origin headers (e.g. raw S3 buckets).
 *
 * Use this client for image-only tile sources where the server does not support CORS.
 * For servers that support CORS, prefer TileWebClient with ImageTileCodec.
 */
export class ImageTileClient implements ITileClient<HTMLImageElement> {
    private readonly _name: string;
    private readonly _urlFactory: IUrlBuilder<ITile2DAddress>;
    private readonly _metrics: ITileMetrics;
    private readonly _options: WebClientOptions;

    public constructor(name: string, urlFactory: IUrlBuilder<ITile2DAddress>, metrics: ITileMetrics, options?: WebClientOptions) {
        this._name = name;
        this._urlFactory = urlFactory;
        this._metrics = metrics;
        this._options = { ...WebClientOptions.getDefault(), ...options };
    }

    public get name(): string {
        return this._name;
    }

    public get metrics(): ITileMetrics {
        return this._metrics;
    }

    public async fetchAsync(request: ITile2DAddress, env?: IGeoBounded, ...userArgs: Array<unknown>): Promise<FetchResult<ITile2DAddress, Nullable<HTMLImageElement>>> {
        if (!request) {
            throw new FetchError("Invalid request parameter.");
        }
        if (TileAddress.IsValidAddress(request, this._metrics) === false) {
            return FetchResult.Null<ITile2DAddress, HTMLImageElement>(request, userArgs);
        }

        const url = this._urlFactory.buildUrl(request, ...userArgs);
        if (!url) {
            throw new FetchError(`Built url of ${request.toString()} can not be null`);
        }

        const maxRetry = this._options.maxRetry ?? 1;
        let retryCount = 0;
        let delay = this._options.initialDelay ?? 1000;

        do {
            try {
                const img = await this._loadImage(url);
                return new FetchResult<ITile2DAddress, Nullable<HTMLImageElement>>(request, img, userArgs);
            } catch (error: any) {
                console.error(`Error loading image ${url}: ${error.message || error}`);

                if (retryCount >= maxRetry - 1) {
                    throw new FetchError(`Exceeded maximum retries for image URL: ${url}`, ...userArgs);
                }
            }

            const jitter = Math.floor(Math.random() * (this._options.initialDelay ?? 1000));
            await new Promise((resolve) => setTimeout(resolve, Math.min(delay + jitter, 30000)));
            delay *= 2;
            retryCount++;
        } while (retryCount < maxRetry);

        throw new FetchError(`Exceeded maximum retries for image URL: ${url}`, ...userArgs);
    }

    private _loadImage(url: string): Promise<HTMLImageElement> {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = () => {
                img.onload = null;
                img.onerror = null;
                resolve(img);
            };
            img.onerror = () => {
                img.onload = null;
                img.onerror = null;
                reject(new Error(`Failed to load image: ${url}`));
            };
            // Do NOT set crossOrigin — this allows loading from no-CORS servers.
            // The trade-off is that this image will taint the canvas (no getImageData/toBlob),
            // but for tile rendering via drawImage this is perfectly fine.
            img.src = url;
        });
    }
}
