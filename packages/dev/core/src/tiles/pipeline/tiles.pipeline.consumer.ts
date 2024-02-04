import { EventState, Observable, PropertyChangedEventArgs } from "../../events";
import { IPipelineMessageType, ITileConsumer } from "./tiles.pipeline.interfaces";
import { ITile, ITileCollection } from "../tiles.interfaces";
import { ValidableBase } from "../../validable";
import { Nullable } from "../../types";

export class TileConsumerBase<T> extends ValidableBase implements ITileConsumer<T> {
    _propertyChangedObservable?: Observable<PropertyChangedEventArgs<unknown, unknown>> | undefined;
    _updatedObservable?: Observable<IPipelineMessageType<ITile<T>>>;
    _addedObservable?: Observable<IPipelineMessageType<ITile<T>>>;
    _removedObservable?: Observable<IPipelineMessageType<ITile<T>>>;

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
        if (this._addedObservable && this._addedObservable.hasObservers()) {
            this._addedObservable.notifyObservers(eventData, -1, eventState.currentTarget, this);
        }
        this._onTileAdded(eventData, eventState);
    }

    public removed(eventData: IPipelineMessageType<ITile<T>>, eventState: EventState): void {
        this.invalidate();
        if (this._removedObservable && this._removedObservable.hasObservers()) {
            this._removedObservable.notifyObservers(eventData, -1, eventState.currentTarget, this);
        }
        this._onTileRemoved(eventData, eventState);
    }

    public updated(eventData: IPipelineMessageType<ITile<T>>, eventState: EventState): void {
        this.invalidate();
        if (this._updatedObservable && this._updatedObservable.hasObservers()) {
            this._updatedObservable.notifyObservers(eventData, -1, eventState.currentTarget, this);
        }
        this._onTileUpdated(eventData, eventState);
    }
    /// end ITargetBlock

    public dispose() {}

    public getActiveTiles(): Nullable<ITileCollection<T>> {
        return null;
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
