import { Observable, PropertyChangedEventArgs } from "../../events";
import { ILinkOptions, IPipelineMessageType, ITargetBlock, ITilePipeline, ITilePipelineLink, ITileProducer, ITileView } from "./tiles.pipeline.interfaces";
import { ITile } from "../tiles.interfaces";
export declare class TilePipeline<T> implements ITilePipeline<T> {
    private _propertyChangedObservable?;
    private _view?;
    private _producer;
    constructor(producer?: ITileProducer<T>, view?: ITileView);
    get propertyChangedObservable(): Observable<PropertyChangedEventArgs<ITilePipeline<T>, unknown>>;
    get view(): ITileView | undefined;
    set view(view: ITileView | undefined);
    get producer(): ITileProducer<T>;
    dispose(): void;
    get addedObservable(): Observable<IPipelineMessageType<ITile<T>>>;
    get removedObservable(): Observable<IPipelineMessageType<ITile<T>>>;
    get updatedObservable(): Observable<IPipelineMessageType<ITile<T>>>;
    linkTo(target: ITargetBlock<ITile<T>>, options?: ILinkOptions): void;
    unlinkFrom(target: ITargetBlock<ITile<T>>): ITilePipelineLink<ITile<T>> | undefined;
}
