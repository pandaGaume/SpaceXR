export declare class ObjectPoolOptions<T> {
    factory: () => T;
    maxCount?: number | undefined;
    clean?: ((o: T) => void) | undefined;
    constructor(factory: () => T, maxCount?: number | undefined, clean?: ((o: T) => void) | undefined);
}
export declare class ObjectPool<T> {
    private _o;
    private pool;
    constructor(options: ObjectPoolOptions<T>);
    alloc(): T;
    free(obj: T): void;
}
