import { Observable, PropertyChangedEventArgs } from "../../events";
import { ILinkOptions, IPipelineMessageType, ITargetBlock, ITilePipeline, ITilePipelineLink, ITileProducer, ITileView } from "./tiles.pipeline.interfaces";
import { ITile } from "../tiles.interfaces";
import { TileProducer } from "./tiles.pipeline.producer";

export class TilePipeline<T> implements ITilePipeline<T> {
    private _propertyChangedObservable?: Observable<PropertyChangedEventArgs<ITilePipeline<T>, unknown>>;

    private _view?: ITileView;
    private _producer: ITileProducer<T>;

    public constructor(producer?: ITileProducer<T>, view?: ITileView) {
        this._view = view;
        this._producer = producer ?? new TileProducer<T>("");
        this._view?.linkTo(this._producer);
    }

    public get propertyChangedObservable(): Observable<PropertyChangedEventArgs<ITilePipeline<T>, unknown>> {
        if (!this._propertyChangedObservable) this._propertyChangedObservable = new Observable<PropertyChangedEventArgs<ITilePipeline<T>, unknown>>();
        return this._propertyChangedObservable;
    }

    public get view(): ITileView | undefined {
        return this._view;
    }

    public set view(view: ITileView | undefined) {
        if (this._view !== view) {
            const old = this._view;
            this._view?.unlinkFrom(this._producer);
            this._view = view;
            this._view?.linkTo(this._producer);

            if (this._propertyChangedObservable?.hasObservers()) {
                const args = new PropertyChangedEventArgs<ITilePipeline<T>, unknown>(this, old, this._view, "view");
                this._propertyChangedObservable.notifyObservers(args, -1, this, this);
            }
        }
    }

    public get producer(): ITileProducer<T> {
        return this._producer;
    }

    dispose(): void {
        this._view?.unlinkFrom(this._producer);
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
