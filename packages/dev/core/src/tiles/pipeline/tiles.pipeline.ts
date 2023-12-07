import { ITileMetrics } from "../tiles.interfaces";
import { ITilePipelineComponent, ITilePipeline, ITileConsumer, ITileProducer, ITileView } from "./tiles.pipeline.interfaces";

export class TilePipelineComponent implements ITilePipelineComponent {
    _id: string;

    public constructor(id: string) {
        this._id = id;
    }

    public get id(): string {
        return this._id;
    }

    public dispose(): void {}
}

export class TilePipeline<T> implements ITilePipeline<T> {
    _view: ITileView;
    _producer: ITileProducer<T>;
    _consumer: ITileConsumer<T>;

    public constructor(view: ITileView, producer: ITileProducer<T>, consumer: ITileConsumer<T>) {
        this._view = view;
        this._producer = producer;
        this._consumer = consumer;
    }

    public get view(): ITileView {
        return this._view;
    }

    public get producer(): ITileProducer<T> {
        return this._producer;
    }

    public get consumer(): ITileConsumer<T> {
        return this._consumer;
    }

    public get metrics(): ITileMetrics {
        return this._producer?.metrics;
    }

    public dispose(): void {}
}
