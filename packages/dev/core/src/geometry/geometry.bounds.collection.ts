import { Bounded, Bounds } from "./geometry.bounds";
import { IBounded, IBounds, IsBounds } from "./geometry.interfaces";

export class BoundedCollection<T extends IBounds | IBounded> extends Bounded {
    private _items: Array<T>;

    public constructor() {
        super();
        this._items = new Array<T>();
    }

    public get data(): Array<T> {
        return this._items;
    }
    public set data(d: Array<T>) {
        this._items = d;
        this.invalidateBounds();
    }
    public get length(): number {
        return this._items.length;
    }

    public push(...views: Array<T>): void {
        this._items.push(...views);
        this.invalidateBounds();
    }

    public pop(): T | undefined {
        const d = this._items.pop();
        if (d) {
            this.invalidateBounds();
        }
        return d;
    }

    public findIndex(predicate: (value: T, index: number, obj: T[]) => unknown, thisArg?: any): number {
        return this._items.findIndex(predicate, thisArg);
    }

    public splice(start: number, deleteCount: number): void {
        this._items.splice(start, deleteCount);
        this.invalidateBounds();
    }

    protected _buildBounds(): IBounds | undefined {
        return Bounds.FromBounds(...this._items.map((v) => (IsBounds(v) ? v : v.boundingBox)));
    }
}
