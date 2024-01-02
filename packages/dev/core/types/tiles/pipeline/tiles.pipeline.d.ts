import { Observable } from "../../events/events.observable";
import { ILinkOptions, IPipelineMessageType, ITargetBlock, ITilePipeline, ITilePipelineLink, ITileProducer, ITileView } from "./tiles.pipeline.interfaces";
import { ITile } from "../tiles.interfaces";
export declare class TilePipeline<T> implements ITilePipeline<T> {
    private _viewAddedObservable?;
    private _viewRemovedObservable?;
    private _view;
    private _producer;
    constructor(producer: ITileProducer<T>, ...view: Array<ITileView>);
    get viewAddedObservable(): Observable<ITileView>;
    get viewRemovedObservable(): Observable<ITileView>;
    get view(): Array<ITileView>;
    get producer(): ITileProducer<T>;
    tryAddView(view: ITileView): boolean;
    tryRemoveView(view: ITileView): boolean;
    dispose(): void;
    get addedObservable(): Observable<IPipelineMessageType<ITile<T>>>;
    get removedObservable(): Observable<IPipelineMessageType<ITile<T>>>;
    get updatedObservable(): Observable<IPipelineMessageType<ITile<T>>>;
    linkTo(target: ITargetBlock<ITile<T>>, options?: ILinkOptions): void;
    unlinkFrom(target: ITargetBlock<ITile<T>>): ITilePipelineLink<ITile<T>> | undefined;
}
