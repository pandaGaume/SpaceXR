import { ITileProvider, ITileProviderBuilder, IsTileProviderBuilder } from "../tiles.interfaces";
import { ITileMapLayer, ITileMapLayerBuilder, ITileMapLayerOptions } from "./tiles.map.interfaces";
import { TileMapLayer } from "./tiles.map.layer";

export class TileMapLayerBuilder<T> implements ITileMapLayerBuilder<T> {
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

    public withOptions(options?: ITileMapLayerOptions): ITileMapLayerBuilder<T> {
        this._zindex = options?.zindex ?? -1;
        this._alpha = options?.alpha !== undefined ? Math.min(Math.max(options?.alpha, 0), 1.0) : 1.0; // default is opaque
        this._zoomOffset = options?.zoomOffset !== undefined ? options?.zoomOffset : 0;
        this._attribution = options?.attribution;
        return this;
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

    public withzoomOffset(value: number): ITileMapLayerBuilder<T> {
        this._zoomOffset = value;
        return this;
    }

    public withAttribution(value: string): ITileMapLayerBuilder<T> {
        this._attribution = value;
        return this;
    }

    public build(): ITileMapLayer<T> {
        if (!this._provider) {
            throw new Error("No provider or provider builder defined");
        }
        const o = {
            zindex: this._zindex ?? -1,
            alpha: this._alpha ?? 1.0,
            zoomOffset: this._zoomOffset,
            attribution: this._attribution,
        };
        if (IsTileProviderBuilder<T>(this._provider)) {
            const p = this._provider?.build();
            return new TileMapLayer<T>(this._name ?? "", p, o, this._enabled);
        }
        return new TileMapLayer<T>(this._name ?? "", this._provider, o, this._enabled);
    }
}
