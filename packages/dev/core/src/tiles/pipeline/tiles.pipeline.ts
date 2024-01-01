import { Observable } from "../../events/events.observable";
import { ILinkOptions, IPipelineMessageType, ITargetBlock, ITilePipeline, ITilePipelineLink, ITileProducer, ITileView } from "./tiles.pipeline.interfaces";
import { ITile } from "../tiles.interfaces";

export class TilePipeline<T> implements ITilePipeline<T> {
    private _viewAddedObservable?: Observable<ITileView>;
    private _viewRemovedObservable?: Observable<ITileView>;

    private _view: Array<ITileView>;
    private _producer: ITileProducer<T>;

    public constructor(producer: ITileProducer<T>, ...view: Array<ITileView>) {
        this._view = view;
        this._producer = producer;
        for (const v of view) {
            v.linkTo(this._producer);
        }
    }

    public get viewAddedObservable(): Observable<ITileView> {
        if (!this._viewAddedObservable) this._viewAddedObservable = new Observable<ITileView>();
        return this._viewAddedObservable;
    }

    public get viewRemovedObservable(): Observable<ITileView> {
        if (!this._viewRemovedObservable) this._viewRemovedObservable = new Observable<ITileView>();
        return this._viewRemovedObservable;
    }

    public get view(): Array<ITileView> {
        return this._view;
    }

    public get producer(): ITileProducer<T> {
        return this._producer;
    }

    public tryAddView(view: ITileView): boolean {
        if (this._view.findIndex((v) => v === view) !== -1) {
            this._view.push(view);
            view.linkTo(this._producer);
            if (this._viewAddedObservable && this._viewAddedObservable.hasObservers()) {
                this._viewAddedObservable.notifyObservers(view, -1, this, this);
            }
            return true;
        }
        return false;
    }

    public tryRemoveView(view: ITileView): boolean {
        const index = this._view.findIndex((v) => v === view);
        if (index !== -1) {
            view.unlinkFrom(this._producer);
            this._view.splice(index, 1);
            if (this._viewRemovedObservable && this._viewRemovedObservable.hasObservers()) {
                this._viewRemovedObservable.notifyObservers(view, -1, this, this);
            }
            return true;
        }
        return false;
    }

    dispose(): void {
        for (const v of this._view) {
            v.state = null;
            v.unlinkFrom(this._producer);
        }
    }

    public get addedObservable(): Observable<IPipelineMessageType<ITile<T>>> {
        return this._producer.addedObservable;
    }

    public get removedObservable(): Observable<IPipelineMessageType<ITile<T>>> {
        return this._producer.removedObservable!;
    }

    public get updatedObservable(): Observable<IPipelineMessageType<ITile<T>>> {
        return this._producer.updatedObservable!;
    }

    public linkTo(target: ITargetBlock<ITile<T>>, options?: ILinkOptions): void {
        this._producer.linkTo(target, options);
    }

    public unlinkFrom(target: ITargetBlock<ITile<T>>): ITilePipelineLink<ITile<T>> | undefined {
        return this._producer.unlinkFrom(target);
    }
}
