export declare class Bearing {
    static Zero(): Bearing;
    static ClampAzimuth(a: number): number;
    private _value;
    private _cos;
    private _sin;
    constructor(value: number);
    get value(): number;
    set value(v: number);
    get cos(): number;
    get sin(): number;
    copyInPlace(other: Bearing): void;
    toString(): string;
}
