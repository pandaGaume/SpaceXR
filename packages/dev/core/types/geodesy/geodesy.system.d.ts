import { Ellipsoid } from "./geodesy.ellipsoid";
import { IEnvelope, IGeo3 } from "../geography/geography.interfaces";
import { ICartesian3 } from "../geometry/geometry.interfaces";
import { Observable } from "../events/events.observable";
import { IDistanceProcessor } from "./geodesy.interfaces";
export declare enum CartesianMode {
    ECEF = 0,
    ENU = 1,
    NED = 2
}
export declare class GeodeticSystem implements IDistanceProcessor {
    static readonly Default: GeodeticSystem;
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
    geodeticToCartesianToRef(geo: IGeo3, target: ICartesian3): void;
    getDistanceFromFloat(lata: number, lona: number, latb: number, lonb: number, alta?: number, altb?: number): number;
}
