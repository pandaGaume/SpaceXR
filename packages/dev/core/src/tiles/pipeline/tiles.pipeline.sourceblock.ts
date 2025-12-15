import { Observable } from "../../events";
import { ILinkOptions, IPipelineMessageType, ISourceBlock, ITargetBlock, ITilePipelineLink } from "./tiles.pipeline.interfaces";
import { TilePipelineLink } from "./tiles.pipeline.link";

export class SourceBlock<T> implements ISourceBlock<T> {
    _addedObservable?: Observable<IPipelineMessageType<T>>;
    _removedObservable?: Observable<IPipelineMessageType<T>>;
    _updatedObservable?: Observable<IPipelineMessageType<T>>;

    // internal pipeline links
    _links: Array<ITilePipelineLink<T>> = [];

    public dispose(): void {
        // dispose the links
        for (const l of this._links) {
            l.dispose();
        }
        this._links = [];
    }

    public get links(): Array<ITilePipelineLink<T>> | undefined {
        return this._links;
    }

    public get addedObservable(): Observable<IPipelineMessageType<T>> {
        this._addedObservable = this._addedObservable || new Observable<IPipelineMessageType<T>>();
        return this._addedObservable!;
    }

    public get removedObservable(): Observable<IPipelineMessageType<T>> {
        this._removedObservable = this._removedObservable || new Observable<IPipelineMessageType<T>>();
        return this._removedObservable!;
    }

    public get updatedObservable(): Observable<IPipelineMessageType<T>> {
        this._updatedObservable = this._updatedObservable || new Observable<IPipelineMessageType<T>>();
        return this._updatedObservable!;
    }

    public linkTo(target: ITargetBlock<T>, options?: ILinkOptions<T>): void {
        // a view may be linked to several targets, so we need to keep track of them.
        if (this._links.findIndex((l) => l.target === target) === -1) {
            const link = new TilePipelineLink(this, target, options);
            this._links.push(link);
        }
    }

    public unlinkFrom(target: ITargetBlock<T>): ITilePipelineLink<T> | undefined {
        const i = this._links.findIndex((l) => l.target === target);
        if (i !== -1) {
            const l = this._links.splice(i)[0];
            l.dispose();
            return l;
        }
        return undefined;
    }

    public notifyAdded(eventData: IPipelineMessageType<T>, mask: number = -1, target?: any, currentTarget?: any, userInfo?: any): boolean {
        if (this._addedObservable?.hasObservers()) {
            return this._addedObservable.notifyObservers(eventData, mask, target, currentTarget, userInfo);
        }
        return false;
    }
    public notifyRemoved(eventData: IPipelineMessageType<T>, mask: number = -1, target?: any, currentTarget?: any, userInfo?: any): boolean {
        if (this._removedObservable?.hasObservers()) {
            return this._removedObservable.notifyObservers(eventData, mask, target, currentTarget, userInfo);
        }
        return false;
    }
    public notifyUpdated(eventData: IPipelineMessageType<T>, mask: number = -1, target?: any, currentTarget?: any, userInfo?: any): boolean {
        if (this._updatedObservable?.hasObservers()) {
            return this._updatedObservable.notifyObservers(eventData, mask, target, currentTarget, userInfo);
        }
        return false;
    }
}
