import { ITileProvider, ITileProviderBuilder } from "../tiles.interfaces";
import { ITileMapLayer, ITileMapLayerBuilder, ITileMapLayerOptions } from "./tiles.map.interfaces";
export declare class TileMapLayerBuilder<T> implements ITileMapLayerBuilder<T> {
    _name?: string;
    _provider?: ITileProvider<T> | ITileProviderBuilder<T>;
    _zindex?: number;
    _zoomOffset?: number;
    _attribution?: string;
    _alpha?: number;
    _enabled?: boolean;
    constructor(name?: string, provider?: ITileProvider<T>);
    get name(): string;
    withOptions(options?: ITileMapLayerOptions): ITileMapLayerBuilder<T>;
    withName(name: string): ITileMapLayerBuilder<T>;
    withProvider(provider: ITileProvider<T> | ITileProviderBuilder<T>): ITileMapLayerBuilder<T>;
    withZIndex(zindex: number): ITileMapLayerBuilder<T>;
    withAlpha(alpha: number): ITileMapLayerBuilder<T>;
    withEnabled(enabled: boolean): ITileMapLayerBuilder<T>;
    withzoomOffset(value: number): ITileMapLayerBuilder<T>;
    withAttribution(value: string): ITileMapLayerBuilder<T>;
    build(): ITileMapLayer<T>;
}
