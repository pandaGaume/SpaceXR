import { IGeo2 } from "../geography";
import { Ellipsoid } from "./geodesy.ellipsoid";
import { IGeoCalculator } from "./geodesy.interfaces";
export declare class SphericalCalculator implements IGeoCalculator {
    static readonly DefaultEllipsoid: Ellipsoid;
    static readonly Shared: SphericalCalculator;
    _ellipsoid: Ellipsoid;
    constructor(ellipsoid?: Ellipsoid);
    getDistanceBetweenTwoPoint(a: IGeo2, b: IGeo2, deg?: boolean | undefined, ellipsoid?: Ellipsoid | undefined): number;
    getDistanceBetweenTwoPoint_Haversine(a: IGeo2, b: IGeo2, deg?: boolean | undefined, ellipsoid?: Ellipsoid | undefined): number;
    getLocationAtDistanceAzimuthToRef(a: IGeo2, dist: number, az: number, ref: IGeo2, deg?: boolean | undefined, ellipsoid?: Ellipsoid | undefined): void;
    getCrossTrackDistance(a: IGeo2, b: IGeo2, c: IGeo2, deg?: boolean | undefined, ellipsoid?: Ellipsoid | undefined): number;
    getCrossArcDistance(a: IGeo2, b: IGeo2, c: IGeo2, deg?: boolean | undefined, ellipsoid?: Ellipsoid | undefined): number;
    getBearing(a: IGeo2, b: IGeo2, deg?: boolean | undefined, ellipsoid?: Ellipsoid | undefined): number;
}
