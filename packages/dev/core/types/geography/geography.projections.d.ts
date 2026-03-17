import { Ellipsoid } from "../geodesy/geodesy.ellipsoid";
import { ICartesian2 } from "../geometry/geometry.interfaces";
export declare class Projections {
    static WebMercatorMaxLatitude: number;
    static WebMercatorMinLatitude: number;
    /**
     * Convert lat/lon to WebMercator x/y
     * @param lat the latitude
     * @param lon the longitude
     * @returns the cartesian2 values
     */
    static LatLonToWebMercator(lat: number, lon: number, ellipsoid?: Ellipsoid): ICartesian2;
    /**
     * Convert lat/lon to WebMercator x/y using object ref to store the result
     * @param lat the latitude
     * @param lon the longitude
     * @param ref the object to store the result
     * @returns the cartesian2 values
     */
    static LatLonToWebMercatorToRef(lat: number, lon: number, ref: ICartesian2, ellipsoid?: Ellipsoid): ICartesian2;
}
