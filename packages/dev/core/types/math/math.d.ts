export type ParametricValue = number;
export declare class Scalar {
    static EPSILON: number;
    static DEG2RAD: number;
    static INCH2METER: number;
    static METER2INCH: number;
    static PI: number;
    static PI_2: number;
    static PI_4: number;
    static WithinEpsilon(a: number, b: number, epsilon?: number): boolean;
    static Sign(value: number): 1 | -1;
    static Clamp(value: number, min: number, max: number): number;
    static GetRandomInt(min: number, max: number): number;
    static ToHex(i: number): string;
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
    static Zero(): Range;
    static Max(): Range;
    protected computeDelta(a: number, b?: number): number;
    constructor(min: number, max?: number);
    union(min: number | Range, max?: number): void;
    clone(): Range;
}
