import { Envelope, GeoBounded } from "./geography.envelope";
import { IEnvelope, IGeoBounded } from "./geography.interfaces";

export class GeoBoundedCollection<T extends IGeoBounded> extends GeoBounded {
    private _items: Array<T>;

    public constructor() {
        super();
        this._items = new Array<T>();
    }

    public push(...views: Array<T>): void {
        this._items.push(...views);
        this.invalidateEnvelope();
    }

    public findIndex(predicate: (value: T, index: number, obj: T[]) => unknown, thisArg?: any): number {
        return this._items.findIndex(predicate, thisArg);
    }

    public splice(start: number, deleteCount: number): void {
        this._items.splice(start, deleteCount);
        this.invalidateEnvelope();
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

    protected _buildEnvelope(): IEnvelope | undefined {
        return Envelope.FromEnvelopes(...this._items.map((v) => v.geoBounds));
    }
}
