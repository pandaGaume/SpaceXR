import { ITileProvider, ITileProviderBuilder, IsTileProviderBuilder } from "../tiles.interfaces";
import { ITileMapLayer, ITileMapLayerBuilder } from "./tiles.map.interfaces";
import { TileMapLayer } from "./tiles.map.layer";

export class TileMapLayerBuilder<T> implements ITileMapLayerBuilder<T> {
    _name?: string;
    _provider?: ITileProvider<T> | ITileProviderBuilder<T>;
    _zindex?: number;
    _alpha?: number;
    _enabled?: boolean;

    public constructor(name?: string, provider?: ITileProvider<T>) {
        this._name = name;
        this._provider = provider;
    }

    public get name(): string {
        return this._name ?? "";
    }

    public withName(name: string): ITileMapLayerBuilder<T> {
        this._name = name;
        return this;
    }

    public withProvider(provider: ITileProvider<T> | ITileProviderBuilder<T>): ITileMapLayerBuilder<T> {
        this._provider = provider;
        return this;
    }

    public withZIndex(zindex: number): ITileMapLayerBuilder<T> {
        this._zindex = zindex;
        return this;
    }

    public withAlpha(alpha: number): ITileMapLayerBuilder<T> {
        this._alpha = alpha;
        return this;
    }

    public withEnabled(enabled: boolean): ITileMapLayerBuilder<T> {
        this._enabled = enabled;
        return this;
    }

    public build(): ITileMapLayer<T> {
        if (!this._provider) {
            throw new Error("No provider or provider builder defined");
        }
        if (IsTileProviderBuilder<T>(this._provider)) {
            const p = this._provider?.build();
            return new TileMapLayer<T>(this._name ?? "", p, this._zindex, this._alpha, this._enabled);
        }
        return new TileMapLayer<T>(this._name ?? "", this._provider, this._zindex, this._alpha, this._enabled);
    }
}
