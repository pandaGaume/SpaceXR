import { Tile } from "../tiles";
import { ITileBuilder, ITileContentProvider, ITileContentProviderBuilder, ITileProvider, ITileProviderBuilder, IsTileContentProviderBuilder } from "../tiles.interfaces";
import { TileProvider } from "./tiles.provider";

export class TileProviderBuilder<T> implements ITileProviderBuilder<T> {
    _enabled?: boolean;
    _factory?: ITileBuilder<T>;
    _contentProvider?: ITileContentProvider<T> | ITileContentProviderBuilder<T>;

    public withEnabled(enabled: boolean): ITileProviderBuilder<T> {
        this._enabled = enabled;
        return this;
    }
    public withFactory(factory: ITileBuilder<T>): ITileProviderBuilder<T> {
        this._factory = factory;
        return this;
    }

    public withContentProvider(contentProvider: ITileContentProvider<T> | ITileContentProviderBuilder<T>): ITileProviderBuilder<T> {
        this._contentProvider = contentProvider;
        return this;
    }

    public build(): ITileProvider<T> {
        if (!this._contentProvider) {
            throw new Error("No provider or provider builder defined");
        }
        if (IsTileContentProviderBuilder<T>(this._contentProvider)) {
            const p = this._contentProvider?.build();
            return new TileProvider<T>(p, this._factory ?? Tile.Builder<T>(), this._enabled);
        }
        return new TileProvider<T>(this._contentProvider, this._factory ?? Tile.Builder<T>(), this._enabled);
    }
}
