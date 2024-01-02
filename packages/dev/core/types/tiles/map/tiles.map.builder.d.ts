import { ITileNavigationApi } from "../navigation/tiles.navigation.interfaces";
import { ITilePipeline, ITilePipelineBuilder } from "../pipeline/tiles.pipeline.interfaces";
import { ITileDisplay } from "../tiles.interfaces";
import { ITileMap, ITileMapBuilder, ITileMapLayer, ITileMapLayerBuilder } from "./tiles.map.interfaces";
export declare abstract class AbstractTileMapBuilder<T> implements ITileMapBuilder<T> {
    protected _name?: string;
    protected _display?: ITileDisplay;
    protected _navigation?: ITileNavigationApi;
    protected _pipeline?: ITilePipeline<T> | ITilePipelineBuilder<T>;
    protected _layers?: Map<string, ITileMapLayer<T>>;
    withName(name: string): ITileMapBuilder<T>;
    withDisplay(display: ITileDisplay): ITileMapBuilder<T>;
    withNavigation(navigation: ITileNavigationApi): ITileMapBuilder<T>;
    withPipeline(pipeline: ITilePipeline<T> | ITilePipelineBuilder<T>): ITileMapBuilder<T>;
    withLayer(...layer: (ITileMapLayer<T> | ITileMapLayerBuilder<T>)[]): ITileMapBuilder<T>;
    abstract build(): ITileMap<T>;
}
