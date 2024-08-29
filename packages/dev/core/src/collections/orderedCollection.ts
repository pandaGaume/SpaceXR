import { EventState } from "../events";
import { Collection } from "./collection";
import { IOrderedCollection, IWeighted } from "./collections.interfaces";

export class OrderedCollection<T extends IWeighted> extends Collection<T> implements IOrderedCollection<T> {
    private _weightCallback: (eventData: IWeighted, eventState: EventState) => void;

    public constructor(...items: Array<T>) {
        super(...items);
        this._weightCallback = this._onWeightChanged;
    }

    protected _addInternal(items: Array<T>): Array<T> {
        const inserted = this._insertInternal(items);
        if (inserted?.length) {
            for (const i of inserted) {
                i.weightChangedObservable?.add(this._weightCallback, -1, false, this, false);
            }
        }
        return inserted;
    }

    protected _insertInternal(items: Array<T>): Array<T> {
        if (!items) {
            return [];
        }
        for (const item of items) {
            // Find the correct position to insert the new item
            let index = this._items.findIndex((item) => (item.weight ?? 0) > (item.weight ?? 0));

            if (index === -1) {
                // If the item is heavier than all items in the array, add it to the end
                this._items.push(item);
            } else {
                // Otherwise, insert it in the correct position
                this._items.splice(index, 0, item);
            }
        }
        return items;
    }

    protected _removeInternal(items: Array<T>): Array<T> {
        const removed = super._removeInternal(items);
        if (removed?.length) {
            for (const i of removed) {
                i.weightChangedObservable?.removeCallback(this._weightCallback, this);
            }
        }
        return removed;
    }

    protected _onWeightChanged(eventData: IWeighted, eventState: EventState): void {
        const item = eventData as T;

        if (item) {
            const inserted = this._insertInternal(super._removeInternal([item]));
            if (inserted?.length) {
                this.invalidate();
            }
        }
    }
}
