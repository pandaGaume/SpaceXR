export declare class ObjectPool<T> {
    private type;
    private metrics;
    private pool;
    constructor(type: new () => T);
    alloc(): T;
    free(obj: T): void;
}
