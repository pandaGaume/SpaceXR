import { ITileProvider, ITileProviderBuilder } from "../tiles.interfaces";
import { ITileMapLayer, ITileMapLayerBuilder, ITileMapLayerOptions } from "./tiles.map.interfaces";
export declare abstract class AbstractTileMapLayerBuilder<T, L extends ITileMapLayer<T>> implements ITileMapLayerBuilder<T, L> {
    _name?: string;
    _provider?: ITileProvider<T> | ITileProviderBuilder<T>;
    _zindex?: number;
    _zoomOffset?: number;
    _attribution?: string;
    _alpha?: number;
    _enabled?: boolean;
    constructor(name?: string, provider?: ITileProvider<T>);
    get name(): string;
    withOptions(options?: ITileMapLayerOptions): ITileMapLayerBuilder<T, L>;
    withName(name: string): ITileMapLayerBuilder<T, L>;
    withProvider(provider: ITileProvider<T> | ITileProviderBuilder<T>): ITileMapLayerBuilder<T, L>;
    withZIndex(zindex: number): ITileMapLayerBuilder<T, L>;
    withAlpha(alpha: number): ITileMapLayerBuilder<T, L>;
    withEnabled(enabled: boolean): ITileMapLayerBuilder<T, L>;
    withzoomOffset(value: number): ITileMapLayerBuilder<T, L>;
    withAttribution(value: string): ITileMapLayerBuilder<T, L>;
    abstract build(): L;
}
