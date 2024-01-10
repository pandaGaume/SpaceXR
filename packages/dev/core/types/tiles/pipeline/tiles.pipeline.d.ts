import { Observable, PropertyChangedEventArgs } from "../../events";
import { ITileConsumer, ITilePipeline, ITileProducer, ITileView } from "./tiles.pipeline.interfaces";
export declare class TilePipeline<T> implements ITilePipeline<T> {
    private _propertyChangedObservable?;
    private _view?;
    private _producer;
    private _consumer?;
    constructor(producer?: ITileProducer<T>, view?: ITileView, consumer?: ITileConsumer<T>);
    get propertyChangedObservable(): Observable<PropertyChangedEventArgs<ITilePipeline<T>, unknown>>;
    get view(): ITileView | undefined;
    set view(view: ITileView | undefined);
    get producer(): ITileProducer<T>;
    get consumer(): ITileConsumer<T> | undefined;
    dispose(): void;
}
