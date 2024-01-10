import { ITileConsumer, ITilePipeline, ITilePipelineBuilder, ITileProducer, ITileView } from "./tiles.pipeline.interfaces";
export declare class TilePipelineBuilder<T> implements ITilePipelineBuilder<T> {
    _consumer?: ITileConsumer<T>;
    _producer?: ITileProducer<T>;
    _view?: ITileView;
    withConsumer(consumer: ITileConsumer<T>): ITilePipelineBuilder<T>;
    withProducer(producer: ITileProducer<T>): ITilePipelineBuilder<T>;
    withView(view: ITileView): ITilePipelineBuilder<T>;
    build(): ITilePipeline<T>;
}
