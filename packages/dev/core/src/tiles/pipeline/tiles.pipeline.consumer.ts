import { EventState, Observable, PropertyChangedEventArgs } from "../../events";
import { ILinkOptions, IPipelineMessageType, ITargetBlock, ITileConsumer, ITilePipelineLink } from "./tiles.pipeline.interfaces";
import { ITile } from "../tiles.interfaces";
import { ValidableBase } from "../../validable";
import { TilePipelineLink } from "./tiles.pipeline.link";

export class TileConsumerBase<T> extends ValidableBase implements ITileConsumer<T> {
    _propertyChangedObservable?: Observable<PropertyChangedEventArgs<unknown, unknown>> | undefined;
    _updatedObservable?: Observable<IPipelineMessageType<ITile<T>>>;
    _addedObservable?: Observable<IPipelineMessageType<ITile<T>>>;
    _removedObservable?: Observable<IPipelineMessageType<ITile<T>>>;

    // internal pipeline links
    _links: Array<ITilePipelineLink<ITile<T>>> = [];

    _name: string;

    public constructor(id: string) {
        super();
        this._name = id;
    }

    public get updatedObservable(): Observable<IPipelineMessageType<ITile<T>>> {
        this._updatedObservable = this._updatedObservable || new Observable<IPipelineMessageType<ITile<T>>>();
        return this._updatedObservable!;
    }

    public get addedObservable(): Observable<IPipelineMessageType<ITile<T>>> {
        this._addedObservable = this._addedObservable || new Observable<IPipelineMessageType<ITile<T>>>();
        return this._addedObservable!;
    }

    public get removedObservable(): Observable<IPipelineMessageType<ITile<T>>> {
        this._removedObservable = this._removedObservable || new Observable<IPipelineMessageType<ITile<T>>>();
        return this._removedObservable!;
    }

    public linkTo(target: ITargetBlock<ITile<T>>, options?: ILinkOptions): void {
        // a view may be linked to several targets, so we need to keep track of them.
        if (this._links.findIndex((l) => l.target === target) === -1) {
            // avoid linking twice to the same target
            const link = new TilePipelineLink(this, target, options);
            this._links.push(link);
        }
    }

    public unlinkFrom(target: ITargetBlock<ITile<T>>): ITilePipelineLink<ITile<T>> | undefined {
        const i = this._links.findIndex((l) => l.target === target);
        if (i !== -1) {
            const l = this._links.splice(i)[0];
            l.dispose();
            return l;
        }
        return undefined;
    }

    public get propertyChangedObservable(): Observable<PropertyChangedEventArgs<unknown, unknown>> {
        if (!this._propertyChangedObservable) {
            this._propertyChangedObservable = new Observable<PropertyChangedEventArgs<unknown, unknown>>();
        }
        return this._propertyChangedObservable;
    }

    public get name(): string {
        return this._name;
    }

    public set name(name: string) {
        if (this._name !== name) {
            if (this._propertyChangedObservable && this._propertyChangedObservable.hasObservers()) {
                const oldValue = this._name;
                this._name = name;
                const args = new PropertyChangedEventArgs<unknown, unknown>(this, oldValue, this._name, "name");
                this._propertyChangedObservable.notifyObservers(args, -1, this, this);
                return;
            }
            this._name = name;
        }
    }

    /// begin ITargetBlock
    public added(eventData: IPipelineMessageType<ITile<T>>, eventState: EventState): void {
        this.invalidate();
        this._onTileAdded(eventData, eventState);
        if (this._addedObservable && this._addedObservable.hasObservers()) {
            this._addedObservable.notifyObservers(eventData, -1, eventState.currentTarget, this);
        }
    }

    public removed(eventData: IPipelineMessageType<ITile<T>>, eventState: EventState): void {
        this.invalidate();
        this._onTileRemoved(eventData, eventState);
        if (this._removedObservable && this._removedObservable.hasObservers()) {
            this._removedObservable.notifyObservers(eventData, -1, eventState.currentTarget, this);
        }
    }

    public updated(eventData: IPipelineMessageType<ITile<T>>, eventState: EventState): void {
        this.invalidate();
        this._onTileUpdated(eventData, eventState);
        if (this._updatedObservable && this._updatedObservable.hasObservers()) {
            this._updatedObservable.notifyObservers(eventData, -1, eventState.currentTarget, this);
        }
    }
    /// end ITargetBlock

    public dispose() {
        // dispose the links
        for (const l of this._links) {
            l.dispose();
        }
        this._links = [];
    }

    protected _onTileAdded(eventData: Array<ITile<T>>, eventState: EventState): void {
        /* nothing to do here, may be override by subclass */
    }
    protected _onTileRemoved(eventData: Array<ITile<T>>, eventState: EventState): void {
        /* nothing to do here, may be override by subclass */
    }
    protected _onTileUpdated(eventData: Array<ITile<T>>, eventState: EventState): void {
        /* nothing to do here, may be override by subclass */
    }
}
