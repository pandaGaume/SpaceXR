import { ITileMetrics } from "../tiles.interfaces";
import { ITilePipelineComponent, ITilePipeline, ITileConsumer, ITileProducer, ITileView } from "./tiles.pipeline.interfaces";
export declare class TilePipelineComponent implements ITilePipelineComponent {
    _id: string;
    constructor(id: string);
    get id(): string;
    dispose(): void;
}
export declare class TilePipeline<T> implements ITilePipeline<T> {
    _view: ITileView;
    _producer: ITileProducer<T>;
    _consumer: ITileConsumer<T>;
    constructor(view: ITileView, producer: ITileProducer<T>, consumer: ITileConsumer<T>);
    get view(): ITileView;
    get producer(): ITileProducer<T>;
    get consumer(): ITileConsumer<T>;
    get metrics(): ITileMetrics;
    dispose(): void;
}
