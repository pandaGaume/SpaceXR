import { Observable } from "../events";
import { isValidable } from "../types";
import { ValidableBase } from "../validable";
import { ICollection } from "./collections.interfaces";

export class Collection<T> extends ValidableBase implements ICollection<T> {
    public static Empty<T>(): ICollection<T> {
        return new Collection<T>();
    }

    private _addedObservable?: Observable<Array<T>>;
    private _removedObservable?: Observable<Array<T>>;

    protected _items: Array<T>;

    public constructor(...items: Array<T>) {
        super();
        this._items = Array.from(items);
    }

    public get addedObservable(): Observable<Array<T>> {
        if (!this._addedObservable) {
            this._addedObservable = new Observable<Array<T>>();
        }
        return this._addedObservable;
    }

    public get removedObservable(): Observable<Array<T>> {
        if (!this._removedObservable) {
            this._removedObservable = new Observable<Array<T>>();
        }
        return this._removedObservable;
    }

    public get count(): number {
        return this._items.length;
    }

    public *get(predicate?: (i: T) => boolean, sorted?: boolean): IterableIterator<T> {
        for (const l of this._items ?? []) {
            if (!predicate || predicate(l)) yield l;
        }
    }

    public add(...item: Array<T>): void {
        const added = this._addInternal(item);
        if (added?.length) {
            if (this._addedObservable && this._addedObservable.hasObservers()) {
                this._addedObservable.notifyObservers(added, -1, this, this);
            }
            this.invalidate();
        }
    }

    public remove(...item: Array<T>): void {
        const removed = this._removeInternal(item);
        if (removed?.length) {
            if (this._removedObservable && this._removedObservable.hasObservers()) {
                this._removedObservable.notifyObservers(removed, -1, this, this);
            }
            this.invalidate();
        }
    }

    public clear(): void {
        if (this._items) {
            const toRemove = Array.from(this._items);
            for (const l of toRemove) {
                this.remove(l);
            }
        }
    }

    public dispose(): void {
        this.clear();
        this._addedObservable?.clear();
        this._removedObservable?.clear();
    }

    public [Symbol.iterator](): IterableIterator<T> {
        let pointer = 0;
        let items = this._items;

        const iterator: IterableIterator<T> = {
            next(): IteratorResult<T> {
                if (pointer < items.length) {
                    return {
                        done: false,
                        value: items[pointer++],
                    };
                }

                return {
                    done: true,
                    value: null as any,
                };
            },
            [Symbol.iterator]() {
                return this;
            },
        };
        return iterator;
    }

    public get isValid(): boolean {
        if (!super.isValid) {
            return false;
        }
        return (
            this._items.every((l) => {
                if (isValidable(l)) {
                    return l.isValid;
                }
                return true;
            }) ?? true
        );
    }

    protected _doValidate(): void {
        for (const i of this._items) {
            if (isValidable(i)) {
                i.validate();
            }
        }
    }

    protected _addInternal(items: Array<T>): Array<T> {
        this._items.push(...items);
        return items;
    }

    protected _removeInternal(items: Array<T>): Array<T> {
        let removed: Array<T> = [];
        for (const item of items) {
            const i = this._items.indexOf(item);
            if (i >= 0) {
                removed.push(...this._items.splice(i, 1));
            }
        }
        return removed;
    }
}
