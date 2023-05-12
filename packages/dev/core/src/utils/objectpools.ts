export class ObjectPoolOptions<T> {
    public constructor(public factory: () => T, public maxCount?: number, public clean?: (o: T) => void) {}
}

export class ObjectPool<T> {
    private _o: ObjectPoolOptions<T>;
    private pool: T[] = [];

    constructor(options: ObjectPoolOptions<T>) {
        this._o = options;
    }

    public alloc(): T {
        let obj = this.pool.pop();

        if (obj) {
            return obj;
        }

        return this._o.factory();
    }

    public free(obj: T) {
        if (this._o.clean) {
            this._o.clean(obj);
        }
        if (!this._o.maxCount || this.pool.length < this._o.maxCount) {
            this.pool.push(obj);
        }
    }
}
