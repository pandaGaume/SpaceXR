import { ITilePipeline, ITilePipelineBuilder, ITileProducer, ITileView } from "./tiles.pipeline.interfaces";
export declare class TilePipelineBuilder<T> implements ITilePipelineBuilder<T> {
    _producer?: ITileProducer<T>;
    _view?: ITileView;
    withProducer(producer: ITileProducer<T>): ITilePipelineBuilder<T>;
    withView(view: ITileView): ITilePipelineBuilder<T>;
    build(): ITilePipeline<T>;
}
