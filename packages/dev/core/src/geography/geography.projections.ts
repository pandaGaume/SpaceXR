import { Ellipsoid } from "../geodesy/geodesy.ellipsoid";
import { Scalar } from "../math/math";
import { Cartesian2 } from "../geometry/geometry.cartesian";
import { ICartesian2 } from "../geometry/geometry.interfaces";

export class Projections {
    public static WebMercatorMaxLatitude = 85.05112878;
    public static WebMercatorMinLatitude = -Projections.WebMercatorMaxLatitude;

    /**
     * Convert lat/lon to WebMercator x/y
     * @param lat the latitude
     * @param lon the longitude
     * @returns the cartesian2 values
     */
    public static LatLonToWebMercator(lat: number, lon: number, ellipsoid?: Ellipsoid): ICartesian2 {
        return Projections.LatLonToWebMercatorToRef(lat, lon, Cartesian2.Zero(), ellipsoid);
    }

    /**
     * Convert lat/lon to WebMercator x/y using object ref to store the result
     * @param lat the latitude
     * @param lon the longitude
     * @param ref the object to store the result
     * @returns the cartesian2 values
     */
    public static LatLonToWebMercatorToRef(lat: number, lon: number, ref: ICartesian2, ellipsoid?: Ellipsoid): ICartesian2 {
        ellipsoid = ellipsoid || Ellipsoid.WGS84;
        ref.x = lon * Scalar.DEG2RAD * ellipsoid.semiMajorAxis;
        // limit latitude to 85.05 degrees
        lat = Scalar.Clamp(lat, Projections.WebMercatorMinLatitude, Projections.WebMercatorMaxLatitude);
        let rad = lat * Scalar.DEG2RAD;
        ref.y = ellipsoid.semiMajorAxis * Math.log(Math.tan(Scalar.PI_4 + rad / 2));
        return ref;
    }
}
