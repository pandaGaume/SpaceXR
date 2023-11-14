export type ParametricValue = number;

export class Scalar {
    public static EPSILON = 1.401298e-45;
    public static DEG2RAD = Math.PI / 180;
    public static INCH2METER = 0.0254;
    public static METER2INCH = 39.3701;

    public static PI = Math.PI;
    public static PI_2 = Math.PI / 2;
    public static PI_4 = Math.PI / 4;

    public static WithinEpsilon(a: number, b: number, epsilon: number = Scalar.EPSILON) {
        const num = a - b;
        return -epsilon <= num && num <= epsilon;
    }

    public static Sign = function (value: number) {
        return value > 0 ? 1 : -1;
    };

    public static Clamp = function (value: number, min: number, max: number) {
        if (min === void 0) {
            min = 0;
        }
        if (max === void 0) {
            max = 1;
        }
        return Math.min(max, Math.max(min, value));
    };

    public static GetRandomInt(min: number, max: number): number {
        min = Math.ceil(min);
        max = Math.floor(max);
        return Math.floor(Math.random() * (max - min + 1)) + min;
    }
}

export abstract class AbstractRange<T> {
    protected _min: T;
    protected _max?: T;
    protected _d?: T;

    public constructor(min: T, max?: T) {
        this._min = min;
        this._max = max;
    }

    public get min(): T {
        return this._min;
    }

    public set min(m: T) {
        this._min = m;
        this._d = undefined;
    }
    public get max(): T | undefined {
        return this._max;
    }

    public set max(m: T | undefined) {
        this._max = m;
        this._d = undefined;
    }

    public get delta(): T {
        if (this._d === undefined) {
            this._d = this.computeDelta(this._min, this._max);
        }
        return this._d;
    }

    protected abstract computeDelta(a: T, b?: T): T;
}

export class Range extends AbstractRange<number> {
    protected computeDelta(a: number, b?: number): number {
        return a && b ? b - a : Number.POSITIVE_INFINITY;
    }
}
