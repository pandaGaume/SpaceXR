import { ITileNavigationState } from "../navigation/tiles.navigation.interfaces";
import { ITilePipeline, ITilePipelineBuilder } from "../pipeline/tiles.pipeline.interfaces";
import { ITileDisplay, ITileMap, ITileMapBuilder, ITileMapLayer, ITileMapLayerBuilder } from "./tiles.map.interfaces";
export declare abstract class AbstractTileMapBuilder<T, L extends ITileMapLayer<T>> implements ITileMapBuilder<T, L> {
    protected _name?: string;
    protected _display?: ITileDisplay;
    protected _navigation?: ITileNavigationState;
    protected _pipeline?: ITilePipeline<T> | ITilePipelineBuilder<T>;
    protected _layers?: Map<string, L>;
    withName(name: string): ITileMapBuilder<T, L>;
    withDisplay(display: ITileDisplay): ITileMapBuilder<T, L>;
    withNavigation(navigation: ITileNavigationState): ITileMapBuilder<T, L>;
    withPipeline(pipeline: ITilePipeline<T> | ITilePipelineBuilder<T>): ITileMapBuilder<T, L>;
    withLayer(...layer: (L | ITileMapLayerBuilder<T, L>)[]): ITileMapBuilder<T, L>;
    get pipeline(): ITilePipeline<T> | undefined;
    abstract build(): ITileMap<T, L, unknown> | undefined;
}
