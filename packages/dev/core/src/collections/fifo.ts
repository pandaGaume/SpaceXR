import { IFifo } from "./collections.interfaces";

export class Fifo<T> implements IFifo<T> {
    private _items: T[] = [];

    public constructor(...data: Array<T>) {
        this._items = data ?? [];
    }

    public enqueue(item: T): void {
        this._items.push(item);
    }

    public dequeue(): T | undefined {
        return this._items.shift();
    }

    public peek(): T | undefined {
        return this._items[0];
    }

    public isEmpty(): boolean {
        return this._items.length === 0;
    }

    public size(): number {
        return this._items.length;
    }

    public clear(): void {
        this._items = [];
    }

    public includes(item: T): boolean {
        return this._items.includes(item);
    }
}
