import { Ellipsoid } from "../geodesy/geodesy.ellipsoid";
import { ICartesian2 } from "../geometry/geometry.interfaces";
export declare class Projections {
    static WebMercatorMaxLatitude: number;
    static WebMercatorMinLatitude: number;
    static LatLonToWebMercator(lat: number, lon: number, ellipsoid?: Ellipsoid): ICartesian2;
    static LatLonToWebMercatorToRef(lat: number, lon: number, ref: ICartesian2, ellipsoid?: Ellipsoid): ICartesian2;
}
