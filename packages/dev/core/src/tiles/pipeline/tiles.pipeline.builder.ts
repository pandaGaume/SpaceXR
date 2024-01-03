import { TilePipeline } from "./tiles.pipeline";
import { ITilePipeline, ITilePipelineBuilder, ITileProducer, ITileView } from "./tiles.pipeline.interfaces";
import { TileProducer } from "./tiles.pipeline.producer";

export class TilePipelineBuilder<T> implements ITilePipelineBuilder<T> {
    _producer?: ITileProducer<T>;
    _view?: ITileView;

    public withProducer(producer: ITileProducer<T>): ITilePipelineBuilder<T> {
        this._producer = producer;
        return this;
    }

    public withView(view: ITileView): ITilePipelineBuilder<T> {
        this._view = view;
        return this;
    }

    public build(): ITilePipeline<T> {
        return new TilePipeline<T>(this._producer ?? new TileProducer<T>(""), this._view);
    }
}
