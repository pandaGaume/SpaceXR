import { Scalar } from "../math/math";
import { Ellipsoid } from "./geodesy.ellipsoid";
import { IDistanceProcessor } from "./geodesy.interfaces";

export class CalculatorBase {
    _ellipsoid: Ellipsoid;

    public constructor(e?: Ellipsoid) {
        this._ellipsoid = e ?? Ellipsoid.WGS84;
    }

    public get ellipsoid(): Ellipsoid {
        return this._ellipsoid;
    }
}

export class HaversineCalculator extends CalculatorBase implements IDistanceProcessor {
    public static readonly Shared = new HaversineCalculator();

    public constructor(e?: Ellipsoid) {
        super(e);
    }

    public getDistanceFromFloat(lata: number, lona: number, latb: number, lonb: number, alta?: number, altb?: number): number {
        if (lata === latb && lona === lonb && alta === altb) {
            return 0;
        }

        lata *= Scalar.DEG2RAD;
        lona *= Scalar.DEG2RAD;
        latb *= Scalar.DEG2RAD;
        lonb *= Scalar.DEG2RAD;

        const dLat = (latb - lata) / 2;
        const dLon = (lonb - lona) / 2;
        const sdLat = Math.sin(dLat);
        const sdlon = Math.sin(dLon);
        const a = sdLat * sdLat + Math.cos(lata) * Math.cos(latb) * sdlon * sdlon;
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        let distance = this._ellipsoid.semiMajorAxis * c; // Distance in ellipsoid units

        if (alta !== undefined && altb !== undefined) {
            /// calculates the straight-line distance considering the altitude difference. This is done using the Pythagorean theorem,
            /// treating the Haversine distance and altitude difference as perpendicular sides of a right triangle.
            const altDifference = altb - alta;
            distance = Math.sqrt(distance * distance + altDifference * altDifference);
        }

        return distance;
    }
}

/// <summary>
/// give the distance between two points using the Pythagorean flat-Earth approximation
/// The Pythagorean flat-Earth approximation assumes that meridians are parallel, that the parallels of latitude
/// are negligibly different from great circles, and that great circles are negligibly different from
/// straight lines. Close to the poles, the parallels of latitude are not only shorter than great circles,
/// but indispensably curved. Taking this into account leads to the use of polar coordinates and the planar law
/// of cosines for computing short distances near the poles. The Polar Coordinate Flat-Earth Formulas computationally
/// only a little more expensive than the Pythagorean Theorem and will give smaller maximum errors for higher latitudes and
/// greater distances. The maximum errors, which depend upon azimuth in addition to separation distance, are equal
/// at 80 degrees latitude when the separation is 33 km (20 mi), 82 degrees at 18 km (11 mi), 84 degrees at 9 km (5.4 mi).
/// But even at 88 degrees the polar error can be as large as 20 meters (66 ft) when the distance between the points is 20 km (12 mi).
/// </summary>
export class PythagoreanFlatEarthCalculator extends CalculatorBase implements IDistanceProcessor {
    public static readonly Shared = new PythagoreanFlatEarthCalculator();

    public constructor(e?: Ellipsoid) {
        super(e);
    }
    public getDistanceFromFloat(lata: number, lona: number, latb: number, lonb: number, alta?: number, altb?: number): number {
        if (lata === latb && lona === lonb && alta === altb) {
            return 0;
        }
        const a = Math.PI / 2 - lata * Scalar.DEG2RAD;
        const b = Math.PI / 2 - latb * Scalar.DEG2RAD;
        const c = Math.sqrt(a * a + b * b - 2 * a * b * Math.cos((lona - lonb) * Scalar.DEG2RAD));
        let distance = this._ellipsoid.semiMajorAxis * c;
        if (alta !== undefined && altb !== undefined) {
            /// calculates the straight-line distance considering the altitude difference. This is done using the Pythagorean theorem,
            /// treating the Haversine distance and altitude difference as perpendicular sides of a right triangle.
            const altDifference = altb - alta;
            distance = Math.sqrt(distance * distance + altDifference * altDifference);
        }
        return distance;
    }
}
