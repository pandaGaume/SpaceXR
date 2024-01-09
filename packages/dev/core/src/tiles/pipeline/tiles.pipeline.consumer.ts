import { EventState, Observable, PropertyChangedEventArgs } from "../../events";
import { IPipelineMessageType, ITileConsumer } from "./tiles.pipeline.interfaces";
import { ITile, ITileCollection } from "../tiles.interfaces";
import { Nullable, ValidableBase } from "../../types";

export class TileConsumerBase<T> extends ValidableBase implements ITileConsumer<T> {
    _propertyChangedObservable?: Observable<PropertyChangedEventArgs<unknown, unknown>> | undefined;

    _name: string;

    public constructor(id: string) {
        super();
        this._name = id;
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
    }

    public removed(eventData: IPipelineMessageType<ITile<T>>, eventState: EventState): void {
        this.invalidate();
        this._onTileRemoved(eventData, eventState);
    }

    public updated(eventData: IPipelineMessageType<ITile<T>>, eventState: EventState): void {
        this.invalidate();
        this._onTileRemoved(eventData, eventState);
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
