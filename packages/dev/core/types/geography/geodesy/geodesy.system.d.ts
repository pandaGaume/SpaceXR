import { Ellipsoid } from "./geodesy.ellipsoid";
export declare class GeodeticSystem {
    static GetENUTransformMatrixFromFloat(lat: number, lon: number, alt?: number, ellipsoid?: Ellipsoid, rowOrder?: boolean): number[];
}
