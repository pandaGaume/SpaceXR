import { ITile, ITileBuilder, ITileContentFetcher, TileConstructor } from "../tiles.interfaces";
import { AbstractTileLoader } from "./tiles.loader.abstract";

export class TileLoader<T> extends AbstractTileLoader<T> {
    _contentProvider: ITileContentFetcher<T>;

    public constructor(provider: ITileContentFetcher<T>, factory?: ITileBuilder<T> | TileConstructor<T>, enabled = true) {
        super(factory, enabled);
        this.factory.withMetrics(provider.metrics).withNamespace(provider.name); // ensure the factory has the right metrics and namespace to build bounds.
        this._contentProvider = provider;
    }

    public _fetchContent(tile: ITile<T>, callback: (t: ITile<T>) => void): ITile<T> {
        return this._contentProvider.fetchContent(tile, callback);
    }
}
