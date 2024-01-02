import { ITilePipeline, ITilePipelineBuilder, ITileProducer, ITileView } from "./tiles.pipeline.interfaces";
export declare class TilePipelineBuilder<T> implements ITilePipelineBuilder<T> {
    _producer?: ITileProducer<T>;
    _view?: Array<ITileView>;
    withProducer(producer: ITileProducer<T>): ITilePipelineBuilder<T>;
    withView(...view: Array<ITileView>): ITilePipelineBuilder<T>;
    build(): ITilePipeline<T>;
}
