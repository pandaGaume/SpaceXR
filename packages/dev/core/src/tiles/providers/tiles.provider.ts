import { ITile, ITileBuilder, ITileContentProvider, TileConstructor } from "../tiles.interfaces";
import { AbstractTileProvider } from "./tiles.provider.abstract";

export class TileProvider<T> extends AbstractTileProvider<T> {
    _contentProvider: ITileContentProvider<T>;

    public constructor(provider: ITileContentProvider<T>, factory?: ITileBuilder<T> | TileConstructor<T>, enabled = true) {
        super(factory, enabled);
        this.factory.withMetrics(provider.metrics).withNamespace(provider.name); // ensure the factory has the right metrics and namespace to build bounds.
        this._contentProvider = provider;
    }

    public _fetchContent(tile: ITile<T>, callback: (t: ITile<T>) => void): ITile<T> {
        return this._contentProvider.fetchContent(tile, callback);
    }
}
