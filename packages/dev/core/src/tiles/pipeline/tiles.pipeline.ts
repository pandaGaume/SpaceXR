import { Observable, PropertyChangedEventArgs } from "../../events";
import { ITileConsumer, ITilePipeline, ITileProducer, ITileView } from "./tiles.pipeline.interfaces";
import { TileProducer } from "./tiles.pipeline.producer";

export class TilePipeline<T> implements ITilePipeline<T> {
    private _propertyChangedObservable?: Observable<PropertyChangedEventArgs<ITilePipeline<T>, unknown>>;

    private _view?: ITileView;
    private _producer: ITileProducer<T>;
    private _consumer?: ITileConsumer<T>;

    public constructor(producer?: ITileProducer<T>, view?: ITileView, consumer?: ITileConsumer<T>) {
        this._view = view;
        this._producer = producer ?? new TileProducer<T>("");
        this._consumer = consumer;
        this._view?.linkTo(this._producer);
        if (this._consumer) this._producer.linkTo(this._consumer);
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

    public get consumer(): ITileConsumer<T> | undefined {
        return this._consumer;
    }

    dispose(): void {
        this._view?.unlinkFrom(this._producer);
        if (this._consumer) {
            this._producer.unlinkFrom(this._consumer);
        }
    }
}
