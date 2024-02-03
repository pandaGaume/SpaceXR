import { ITileProvider, ITileProviderBuilder } from "../tiles.interfaces";
import { ITileMapLayer, ITileMapLayerBuilder, ITileMapLayerOptions } from "./tiles.map.interfaces";

export abstract class AbstractTileMapLayerBuilder<T, L extends ITileMapLayer<T>> implements ITileMapLayerBuilder<T, L> {
    _name?: string;
    _provider?: ITileProvider<T> | ITileProviderBuilder<T>;
    _zindex?: number;
    _zoomOffset?: number;
    _attribution?: string;
    _alpha?: number;
    _enabled?: boolean;

    public constructor(name?: string, provider?: ITileProvider<T>) {
        this._name = name;
        this._provider = provider;
    }

    public get name(): string {
        return this._name ?? "";
    }

    public withOptions(options?: ITileMapLayerOptions): ITileMapLayerBuilder<T, L> {
        this._zindex = options?.zindex ?? -1;
        this._zoomOffset = options?.zoomOffset !== undefined ? options?.zoomOffset : 0;
        this._attribution = options?.attribution;
        return this;
    }

    public withName(name: string): ITileMapLayerBuilder<T, L> {
        this._name = name;
        return this;
    }

    public withProvider(provider: ITileProvider<T> | ITileProviderBuilder<T>): ITileMapLayerBuilder<T, L> {
        this._provider = provider;
        return this;
    }

    public withZIndex(zindex: number): ITileMapLayerBuilder<T, L> {
        this._zindex = zindex;
        return this;
    }

    public withAlpha(alpha: number): ITileMapLayerBuilder<T, L> {
        this._alpha = alpha;
        return this;
    }

    public withEnabled(enabled: boolean): ITileMapLayerBuilder<T, L> {
        this._enabled = enabled;
        return this;
    }

    public withzoomOffset(value: number): ITileMapLayerBuilder<T, L> {
        this._zoomOffset = value;
        return this;
    }

    public withAttribution(value: string): ITileMapLayerBuilder<T, L> {
        this._attribution = value;
        return this;
    }

    public abstract build(): L;
}
