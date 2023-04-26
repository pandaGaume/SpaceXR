export type ParametricValue = number;
export declare class Scalar {
    static EPSILON: number;
    static DEG2RAD: number;
    static WithinEpsilon(a: number, b: number, epsilon?: number): boolean;
    static Sign: (value: number) => 1 | -1;
    static Clamp: (value: number, min: number, max: number) => number;
}
export declare abstract class AbstractRange<T> {
    protected _min: T;
    protected _max?: T;
    protected _d?: T;
    constructor(min: T, max?: T);
    get min(): T;
    set min(m: T);
    get max(): T | undefined;
    set max(m: T | undefined);
    get delta(): T;
    protected abstract computeDelta(a: T, b?: T): T;
}
export declare class Range extends AbstractRange<number> {
    protected computeDelta(a: number, b?: number): number;
}
