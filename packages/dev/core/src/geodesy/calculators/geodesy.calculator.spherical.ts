import { Geo2, IGeo2 } from "../../geography";
import { Scalar } from "../../math";
import { CalculatorBase } from "../geodesy.calculators";
import { Ellipsoid } from "../geodesy.ellipsoid";

export class SphericalCalculator extends CalculatorBase {
    public static readonly Shared = new SphericalCalculator();

    public constructor(e?: Ellipsoid) {
        super(e);
    }

    public getDistanceFromFloat(lata: number, lona: number, latb: number, lonb: number, alta?: number, altb?: number, deg?: true): number {
        if (lata === latb && lona === lonb && alta === altb) {
            return 0;
        }

        if (deg) {
            lata *= Scalar.DEG2RAD;
            lona *= Scalar.DEG2RAD;
            latb *= Scalar.DEG2RAD;
            lonb *= Scalar.DEG2RAD;
        }

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

    public getAzimuthFromFloat(lat1: number, lon1: number, lat2: number, lon2: number, deg?: true): number {
        if (lat1 === lat2 && lon1 === lon2) {
            return 0;
        }

        if (deg) {
            lat1 *= Scalar.DEG2RAD;
            lon1 *= Scalar.DEG2RAD;
            lat2 *= Scalar.DEG2RAD;
            lon2 *= Scalar.DEG2RAD;
        }
        const dlon = lon2 - lon1;
        const coslat2 = Math.cos(lat2);

        const y = Math.sin(dlon) * coslat2;
        const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * coslat2 * Math.cos(dlon);
        let az = Math.atan2(y, x);
        if (deg) {
            az *= Scalar.RAD2DEG;
        }
        return az;
    }

    public getLocationAtDistanceAzimuth(lat: number, lon: number, dist: number, az: number, deg?: true): IGeo2 {
        if (dist == 0) {
            return new Geo2(lat, lon);
        }

        if (deg) {
            lat *= Scalar.DEG2RAD;
            lon *= Scalar.DEG2RAD;
            az *= Scalar.DEG2RAD;
        }

        const ddr = dist / this._ellipsoid.semiMajorAxis;
        const cosddr = Math.cos(ddr);
        const sinddr = Math.sin(ddr);
        const coslat = Math.cos(lat);
        const sinlat = Math.sin(lat);
        const coslatsinddr = coslat * sinddr;

        let lat1 = Math.asin(sinlat * cosddr + coslatsinddr * Math.cos(az));
        let lon1 = lon + Math.atan2(coslatsinddr * Math.sin(az), cosddr - sinlat * Math.sin(lat1));
        if (deg) {
            lat1 *= Scalar.RAD2DEG;
            lon1 *= Scalar.RAD2DEG;
        }
        return new Geo2(lat1, lon1);
    }
}
