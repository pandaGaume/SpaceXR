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

import { Geo2, IGeo2 } from "../../geography";
import { Scalar } from "../../math";
import { CalculatorBase } from "../geodesy.calculators";
import { Ellipsoid } from "../geodesy.ellipsoid";

/// </summary>
export class PythagoreanFlatEarthCalculator extends CalculatorBase {
    public static readonly Shared = new PythagoreanFlatEarthCalculator();

    public constructor(e?: Ellipsoid) {
        super(e);
    }

    public getDistanceFromFloat(lata: number, lona: number, latb: number, lonb: number, alta?: number, altb?: number, deg?: boolean): number {
        if (lata === latb && lona === lonb) {
            return 0;
        }
        if (deg) {
            lata *= Scalar.DEG2RAD;
            lona *= Scalar.DEG2RAD;
            latb *= Scalar.DEG2RAD;
            lonb *= Scalar.DEG2RAD;
        }
        const a = Math.PI / 2 - lata;
        const b = Math.PI / 2 - latb;
        const c = Math.sqrt(a * a + b * b - 2 * a * b * Math.cos(lona - lonb));
        let distance = this._ellipsoid.semiMajorAxis * c;

        return distance;
    }

    public getAzimuthFromFloat(lat1: number, lon1: number, lat2: number, lon2: number, deg?: boolean): number {
        if (lat1 === lat2 && lon1 === lon2) {
            return 0;
        }
        if (deg) {
            lat1 *= Scalar.DEG2RAD;
            lon1 *= Scalar.DEG2RAD;
            lat2 *= Scalar.DEG2RAD;
            lon2 *= Scalar.DEG2RAD;
        }
        // Calculate differences in coordinates
        const dLon = lon2 - lon1;
        const dLat = lat2 - lat1;

        // Calculate azimuth
        let azimuth = Math.atan2(dLon, dLat);
        // Normalize to 0-360 degrees
        if (azimuth < 0) {
            azimuth += Scalar.PI_2;
        }
        // Convert to degrees if required
        if (deg) {
            azimuth *= Scalar.RAD2DEG;
        }

        return azimuth;
    }

    public getLocationAtDistanceAzimuth(lat1: number, lon1: number, dist: number, az: number, deg?: boolean): IGeo2 {
        const unit2deg = 1 / (((2 * Math.PI) / 360) * this._ellipsoid.semiMajorAxis);

        // Convert azimuth to radians
        if (deg) {
            az *= Scalar.DEG2RAD;
            lat1 *= Scalar.DEG2RAD;
            lon1 *= Scalar.DEG2RAD;
        }

        // Calculate new latitude and longitude in degrees
        let newLat = lat1 + dist * Math.cos(az) * unit2deg;
        let newLon = lon1 + (dist * Math.sin(az) * unit2deg) / Math.cos(lat1);

        if (deg) {
            newLat *= Scalar.RAD2DEG;
            newLon *= Scalar.RAD2DEG;
        }
        return new Geo2(newLat, newLon);
    }
}
