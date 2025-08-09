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
}
