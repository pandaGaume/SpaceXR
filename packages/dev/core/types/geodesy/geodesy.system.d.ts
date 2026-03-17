import { Ellipsoid } from "./geodesy.ellipsoid";
import { IEnvelope, IGeo3 } from "../geography/geography.interfaces";
import { ICartesian3 } from "../geometry/geometry.interfaces";
import { Observable } from "../events/events.observable";
export declare enum CartesianMode {
    ECEF = 0,
    ENU = 1,
    NED = 2
}
export declare class GeodeticSystem {
    static readonly Default: GeodeticSystem;
    /**
     * Given lat, lon and alt, return an array of 16, which is the enu transformation matrix (4x4)
     * @param lat the reference latitude
     * @param lon the reference longitude
     * @param alt the reference altitude, default is zero
     * @param ellipsoid the reference ellipsoid, default is Ellipsoid.WGS84
     * @param rowOrder the matrix order returned. true is row order, false is column order. default is true, so row order.
     * @returns
     */
    static GetENUTransformMatrixFromFloat(lat: number, lon: number, alt?: number, ellipsoid?: Ellipsoid, rowOrder?: boolean): Array<number>;
    _ellipsoid: Ellipsoid;
    _bounds?: IEnvelope;
    _enuReference?: IGeo3;
    _enuTransform?: Array<number>;
    _enuObservable?: Observable<GeodeticSystem>;
    constructor(e?: Ellipsoid, bounds?: IEnvelope);
    get ellipsoid(): Ellipsoid;
    get ENUReference(): IGeo3 | undefined;
    set ENUReference(v: IGeo3 | undefined);
    get ENUTransform(): Array<number> | undefined;
    get ENUObservable(): Observable<GeodeticSystem>;
    get cartesianMode(): CartesianMode;
    geodeticFloatToCartesianToRef(lat: number, lon: number, alt: number, target: ICartesian3, deg?: boolean): ICartesian3;
    geodeticToCartesianToRef(geo: IGeo3, target: ICartesian3): ICartesian3;
    cartesianToGeodetic(from: ICartesian3, target: IGeo3): boolean;
}
