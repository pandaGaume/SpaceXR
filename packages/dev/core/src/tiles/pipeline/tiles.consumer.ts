import { EventState, Observer } from "../../events/events.observable";
import { ITileConsumer, ITileProducer } from "./tiles.pipeline.interfaces";
import { IValidable, Nullable } from "../../types";
import { ITile } from "../tiles.interfaces";

interface ITileConsumerItem<T> {
    _producer: ITileProducer<T>;
    _addedObserver?: Nullable<Observer<Array<ITile<T>>>>;
    _removedObserver?: Nullable<Observer<Array<ITile<T>>>>;
    _updateObserver?: Nullable<Observer<ITile<T>>>;
}

export class TileConsumerBase<T> implements ITileConsumer<T>, IValidable<TileConsumerBase<T>> {
    _id?: string;
    _valid: boolean;
    protected _items?: Map<string, ITileConsumerItem<T>>;

    public constructor(id: string) {
        this._id = id;
        this._valid = false;
    }

    public get id(): string | undefined {
        return this._id;
    }
    public get isValid(): boolean {
        return this._valid;
    }

    public invalidate(): TileConsumerBase<T> {
        this._valid = false;
        return this;
    }

    public validate(): TileConsumerBase<T> {
        if (!this._valid) {
            this._doValidateInternal();
            this._valid = true;
        }
        return this;
    }

    public revalidate(): TileConsumerBase<T> {
        return this.invalidate().validate();
    }
    public addProducer(producer: ITileProducer<T>): void {
        if (!this._items) {
            this._items = new Map<string, ITileConsumerItem<T>>();
        }
        if (producer.id === undefined || producer.id === "") {
            return;
        }
        if (this._items.has(producer.id)) {
            // remove previous producer with same id
            const old = this._items.get(producer.id);
            if (old?._producer === producer) {
                return; // nothing to do, already in.
            }
            this.removeProducer(producer.id);
        }
        const item: ITileConsumerItem<T> = {
            _producer: producer,
            _addedObserver: producer.tileAddedObservable.add((d, s) => {
                this.invalidate();
                this._onTileAdded(d, s);
            }),
            _removedObserver: producer.tileRemovedObservable.add((d, s) => {
                this.invalidate();
                this._onTileRemoved(d, s);
            }),
            _updateObserver: producer.tileUpdatedObservable.add((d, s) => {
                this.invalidate();
                this._onTileUpdated(d, s);
            }),
        };
        this._items.set(producer.id, item);
    }

    public removeProducer(name: string): void {
        if (!this._items) {
            return;
        }
        const item = this._items.get(name);
        if (!item) {
            return;
        }
        this._items.delete(name);

        item._addedObserver?.dispose();
        item._removedObserver?.dispose();
        item._updateObserver?.dispose();
        if (this._items.size === 0) {
            this._items = undefined;
        }
    }

    public getProducerByName(name: string): ITileProducer<T> | undefined {
        if (!this._items) {
            return undefined;
        }
        return this._items.get(name)?._producer;
    }

    public dispose(): void {
        const keys = [...(this._items?.keys() ?? [])];
        for (const k of keys) {
            this.removeProducer(k);
        }
    }

    public *producers(): IterableIterator<ITileProducer<T>> {
        if (this._items) {
            for (const p of this._items.values()) {
                yield p._producer;
            }
        }
    }

    protected _onTileAdded(eventData: Array<ITile<T>>, eventState: EventState): void {
        /* nothing to do here, may be override by subclass */
    }
    protected _onTileRemoved(eventData: Array<ITile<T>>, eventState: EventState): void {
        /* nothing to do here, may be override by subclass */
    }
    protected _onTileUpdated(eventData: ITile<T>, eventState: EventState): void {
        /* nothing to do here, may be override by subclass */
    }

    protected _doValidateInternal() {
        this._beforeValidate();
        this._doValidate();
        this._afterValidate();
    }

    protected _beforeValidate() {
        /* nothing to do here, may be override by subclass */
    }
    protected _doValidate() {
        /* nothing to do here, may be override by subclass */
    }
    protected _afterValidate() {
        /* nothing to do here, may be override by subclass */
    }
}
