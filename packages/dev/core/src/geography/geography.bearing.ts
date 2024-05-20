export class Bearing {
    public static Zero(): Bearing {
        return new Bearing(0);
    }
    /**
     * Keep an azimuth angle within the range of 0 to 360 degrees
     * @param a the azimuth value
     * @returns the clampled value.
     */
    public static ClampAzimuth(a: number): number {
        // the modulo operator (%) is used to get the remainder when the azimuth is divided by 360.
        // Adding 360 to the result ensures that negative values are shifted into the positive range.
        // Finally, taking the modulo 360 of the sum ensures that values greater than 360 are wrapped
        // back to the range of 0 to 360.
        return ((a % 360) + 360) % 360;
    }

    private _value: number;
    private _cos: number;
    private _sin: number;

    public constructor(value: number) {
        this._value = Bearing.ClampAzimuth(value);
        const rad = (this._value * Math.PI) / 180;
        this._cos = Math.cos(rad);
        this._sin = Math.sin(rad);
    }

    public get value(): number {
        return this._value;
    }

    public get radian(): number {
        return (this._value * Math.PI) / 180;
    }

    public set value(v: number) {
        const clamped = Bearing.ClampAzimuth(v);
        if (this._value !== clamped) {
            this._value = clamped;
            const rad = (this._value * Math.PI) / 180;
            this._cos = Math.cos(rad);
            this._sin = Math.sin(rad);
        }
    }

    public get cos(): number {
        return this._cos;
    }

    public get sin(): number {
        return this._sin;
    }

    public additiveInverse(): Bearing {
        return new Bearing(-this._value);
    }

    public copyInPlace(other: Bearing): void {
        this._value = other._value;
        this._cos = other._cos;
        this._sin = other._sin;
    }

    public toString(): string {
        return `${this._value}°`;
    }
}
