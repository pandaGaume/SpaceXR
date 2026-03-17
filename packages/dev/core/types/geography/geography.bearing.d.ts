export declare class Bearing {
    static Zero(): Bearing;
    /**
     * Keep an azimuth angle within the range of 0 to 360 degrees
     * @param a the azimuth value
     * @returns the clampled value.
     */
    static ClampAzimuth(a: number): number;
    private _value;
    private _cos;
    private _sin;
    constructor(value: number);
    get value(): number;
    get radian(): number;
    set value(v: number);
    get cos(): number;
    get sin(): number;
    additiveInverse(): Bearing;
    copyInPlace(other: Bearing): void;
    toString(): string;
}
