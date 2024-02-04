import { IGeo2 } from "../geography";
import { Ellipsoid } from "./geodesy.ellipsoid";
import { IGeoCalculator } from "./geodesy.interfaces";

export class SphericalCalculator implements IGeoCalculator {
    public static readonly DefaultEllipsoid = Ellipsoid.WGS84;
    public static readonly Shared = new SphericalCalculator();

    _ellipsoid: Ellipsoid;

    public constructor(ellipsoid?: Ellipsoid) {
        this._ellipsoid = ellipsoid ?? SphericalCalculator.DefaultEllipsoid;
    }

    public getDistanceBetweenTwoPoint(a: IGeo2, b: IGeo2, deg?: boolean | undefined, ellipsoid?: Ellipsoid | undefined): number {
        throw new Error("Method not implemented.");
    }
    public getDistanceBetweenTwoPoint_Haversine(a: IGeo2, b: IGeo2, deg?: boolean | undefined, ellipsoid?: Ellipsoid | undefined): number {
        throw new Error("Method not implemented.");
    }
    public getLocationAtDistanceAzimuthToRef(a: IGeo2, dist: number, az: number, ref: IGeo2, deg?: boolean | undefined, ellipsoid?: Ellipsoid | undefined): void {
        throw new Error("Method not implemented.");
    }
    public getCrossTrackDistance(a: IGeo2, b: IGeo2, c: IGeo2, deg?: boolean | undefined, ellipsoid?: Ellipsoid | undefined): number {
        throw new Error("Method not implemented.");
    }
    public getCrossArcDistance(a: IGeo2, b: IGeo2, c: IGeo2, deg?: boolean | undefined, ellipsoid?: Ellipsoid | undefined): number {
        throw new Error("Method not implemented.");
    }
    public getBearing(a: IGeo2, b: IGeo2, deg?: boolean | undefined, ellipsoid?: Ellipsoid | undefined): number {
        throw new Error("Method not implemented.");
    }
}
