//import { GeodeticRange } from "../geography.location";
import { Ellipsoid } from "./geodesy.ellipsoid";

export class GeodeticSystem {
    
    //_ellipsoid: Ellipsoid;
    //_range: GeodeticRange;

    /**
     * Given lat, lon and alt, return an array of 16, which is the enu transformation matrix (4x4)
     * @param lat the reference latitude
     * @param lon the reference longitude
     * @param alt the reference altitude, default is zero
     * @param ellipsoid the reference ellipsoid, default is Ellipsoid.WGS84
     * @param rowOrder the matrix order returned. true is row order, false is column order. default is true, so row order.
     * Babylonjs is row order, directX is row order, opengl is column order, threejs is column order.
     * @returns
     */
    public static GetENUTransformMatrixFromFloat(lat: number, lon: number, alt = 0, ellipsoid: Ellipsoid = Ellipsoid.WGS84, rowOrder = true) {
        const DE2RA = Math.PI / 180;

        // this is equivalent of geodeticToECEFFromFloatToRef, but we duplicate the code to avoid
        // duplicate trigonometric calculation.
        const lambda = lat * DE2RA;
        const phi = lon * DE2RA;

        const sin_lambda = Math.sin(lambda);
        const N = ellipsoid.semiMajorAxis / Math.sqrt(1 - ellipsoid.sqrEccentricity * sin_lambda * sin_lambda);
        const cos_lambda = Math.cos(lambda);
        const cos_phi = Math.cos(phi);
        const sin_phi = Math.sin(phi);
        const tmp = (alt + N) * cos_lambda;
        const x = tmp * cos_phi;
        const y = tmp * sin_phi;
        const z = (alt + ellipsoid.oneMinusSqrEccentricity * N) * sin_lambda;

        const om0 = -sin_phi;
        const om1 = -sin_lambda * cos_phi;
        const om2 = cos_lambda * cos_phi;
        const om4 = cos_phi;
        const om5 = -sin_lambda * sin_phi;
        const om6 = cos_lambda * sin_phi;
        const om9 = cos_lambda;
        const om10 = sin_lambda;

        if (rowOrder) {
            return [om0, om1, om2, 0, om4, om5, om6, 0, 0, om9, om10, 0, -x * om0 - y * om4, -x * om1 - y * om5 - z * om9, -x * om2 - y * om6 - z * om10, 1.0];
        } else {
            return [om0, om4, 0, -x * om0 - y * om4, om1, om5, om9, -x * om1 - y * om5 - z * om9, om2, om6, om10, -x * om2 - y * om6 - z * om10, 0, 0, 0, 1.0];
        }
    }
}
