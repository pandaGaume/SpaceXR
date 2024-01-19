import { ITileNavigationState } from "../navigation/tiles.navigation.interfaces";
import { ITilePipeline, ITilePipelineBuilder } from "../pipeline/tiles.pipeline.interfaces";
import { ITileDisplay, ITileMap, ITileMapBuilder, ITileMapLayer, ITileMapLayerBuilder } from "./tiles.map.interfaces";
export declare abstract class AbstractTileMapBuilder<T> implements ITileMapBuilder<T> {
    protected _name?: string;
    protected _display?: ITileDisplay;
    protected _navigation?: ITileNavigationState;
    protected _pipeline?: ITilePipeline<T> | ITilePipelineBuilder<T>;
    protected _layers?: Map<string, ITileMapLayer<T>>;
    withName(name: string): ITileMapBuilder<T>;
    withDisplay(display: ITileDisplay): ITileMapBuilder<T>;
    withNavigation(navigation: ITileNavigationState): ITileMapBuilder<T>;
    withPipeline(pipeline: ITilePipeline<T> | ITilePipelineBuilder<T>): ITileMapBuilder<T>;
    withLayer(...layer: (ITileMapLayer<T> | ITileMapLayerBuilder<T>)[]): ITileMapBuilder<T>;
    get pipeline(): ITilePipeline<T> | undefined;
    abstract build(): ITileMap<T> | undefined;
}
