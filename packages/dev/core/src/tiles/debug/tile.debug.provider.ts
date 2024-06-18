import { AbstractTileProvider } from "../providers";
import { ITile, ITileMetrics } from "../tiles.interfaces";

export class DebugProvider<T> extends AbstractTileProvider<T> {
    static readonly DEFAULT_NAMESPACE = "DebugProvider";

    private _data: T;
    private _metrics: ITileMetrics;

    public constructor(namespace: string, metrics: ITileMetrics, data: T) {
        super();
        this._metrics = metrics;
        this._data = data;
        this.factory.withMetrics(this._metrics).withNamespace(namespace ?? DebugProvider.DEFAULT_NAMESPACE); // ensure the factory has the right metrics and namespace to build bounds.
    }

    public get metrics(): ITileMetrics {
        return this._metrics;
    }

    public _fetchContent(tile: ITile<T>, callback: (t: ITile<T>) => void): ITile<T> {
        tile.content = this._data;
        return tile;
    }
}
