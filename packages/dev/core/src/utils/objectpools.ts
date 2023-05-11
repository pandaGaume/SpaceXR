export class ObjectPool<T> {
    private metrics = {
        allocated: 0,
        free: 0,
    };

    private pool: T[] = [];

    constructor(private type: new () => T) {}

    public alloc(): T {
        let obj = this.pool.pop();

        if (obj) {
            this.metrics.free--;
            return obj;
        }

        this.metrics.allocated++;
        return new this.type();
    }

    public free(obj: T) {
        this.pool.push(obj);
        this.metrics.free++;
    }
}
