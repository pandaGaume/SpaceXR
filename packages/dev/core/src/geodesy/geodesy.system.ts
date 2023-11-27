import { Ellipsoid } from "./geodesy.ellipsoid";
import { IEnvelope, IGeo3 } from "../geography/geography.interfaces";
import { ICartesian3 } from "../geometry/geometry.interfaces";
import { Observable } from "../events/events.observable";
import { Scalar } from "../math";
import { HaversineCalculator } from "./geodesy.calculators";
import { IDistanceProcessor } from "./geodesy.interfaces";

export enum CartesianMode {
    ECEF,
    ENU,
    NED,
}

export class GeodeticSystem {
    public static readonly Default: GeodeticSystem = new GeodeticSystem(Ellipsoid.WGS84);
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
    public static GetENUTransformMatrixFromFloat(lat: number, lon: number, alt = 0, ellipsoid: Ellipsoid = Ellipsoid.WGS84, rowOrder = true): Array<number> {
        const lambda = lat * Scalar.DEG2RAD;
        const phi = lon * Scalar.DEG2RAD;

        // compute ref as ECEF
        const sin_lambda = Math.sin(lambda);
        const N = ellipsoid.semiMajorAxis / Math.sqrt(1 - ellipsoid.sqrEccentricity * sin_lambda * sin_lambda);
        const cos_lambda = Math.cos(lambda);
        const cos_phi = Math.cos(phi);
        const sin_phi = Math.sin(phi);
        const tmp = (alt + N) * cos_lambda;
        const x = tmp * cos_phi;
        const y = tmp * sin_phi;
        const z = (alt + ellipsoid.oneMinusSqrEccentricity * N) * sin_lambda;

        // then transformation matrix.
        const om0 = -sin_phi;
        const om1 = -sin_lambda * cos_phi;
        const om2 = cos_lambda * cos_phi;
        const om4 = cos_phi;
        const om5 = -sin_lambda * sin_phi;
        const om6 = cos_lambda * sin_phi;
        const om9 = cos_lambda;
        const om10 = sin_lambda;
        const om12 = -x * om0 - y * om4;
        const om13 = -x * om1 - y * om5 - z * om9;
        const om14 = -x * om2 - y * om6 - z * om10;

        if (rowOrder) {
            return [om0, om1, om2, 0, om4, om5, om6, 0, 0, om9, om10, 0, om12, om13, om14, 1.0];
        } else {
            return [om0, om4, 0, om12, om1, om5, om9, om13, om2, om6, om10, om14, 0, 0, 0, 1.0];
        }
    }

    _ellipsoid: Ellipsoid;
    _bounds?: IEnvelope;
    _enuReference?: IGeo3;
    _enuTransform?: Array<number>;
    _enuObservable?: Observable<GeodeticSystem>;
    _calculator: IDistanceProcessor;

    public constructor(e?: Ellipsoid, bounds?: IEnvelope, calculator?: IDistanceProcessor) {
        this._ellipsoid = e || Ellipsoid.WGS84;
        this._bounds = bounds;
        this._calculator = calculator ?? HaversineCalculator.Shared;
    }

    public get calculator(): IDistanceProcessor {
        return this._calculator;
    }

    public get ellipsoid(): Ellipsoid {
        return this._ellipsoid;
    }

    public get ENUReference(): IGeo3 | undefined {
        return this._enuReference;
    }

    public set ENUReference(v: IGeo3 | undefined) {
        if (this._enuReference) {
            if (this._enuReference.equals(v)) {
                return;
            }
            this._enuReference = v?.clone();
            this._enuTransform = undefined;
            if (this._enuObservable && this._enuObservable.hasObservers()) {
                this._enuObservable.notifyObservers(this);
            }
        }
    }

    public get ENUTransform(): Array<number> | undefined {
        if (this._enuTransform === undefined && this._enuReference) {
            this._enuTransform = GeodeticSystem.GetENUTransformMatrixFromFloat(this._enuReference.lat, this._enuReference.lon, this._enuReference.alt, this._ellipsoid);
        }
        return this._enuTransform;
    }

    public get ENUObservable(): Observable<GeodeticSystem> {
        this._enuObservable = this._enuObservable || new Observable();
        return this._enuObservable;
    }

    public get cartesianMode(): CartesianMode {
        return this._enuReference !== undefined ? CartesianMode.ENU : CartesianMode.ECEF;
    }

    public geodeticToCartesianToRef(geo: IGeo3, target: ICartesian3): void {
        if (geo && target) {
            let lambda = geo.lat * Scalar.DEG2RAD;
            let phi = geo.lon * Scalar.DEG2RAD;
            let alt = geo.alt || 0;

            // firs pass is to ECEF
            const sin_lambda = Math.sin(lambda);
            const cos_lambda = Math.cos(lambda);
            const cos_phi = Math.cos(phi);
            const sin_phi = Math.sin(phi);
            const N = this._ellipsoid._a / Math.sqrt(1.0 - this._ellipsoid._ee * sin_lambda * sin_lambda);
            const tmp = (alt + N) * cos_lambda;

            let x = tmp * cos_phi;
            let y = tmp * sin_phi;
            let z = (alt + this._ellipsoid._p1mee * N) * sin_lambda;

            // then to ENU if the transformation is set
            if (this.ENUTransform) {
                const m = this.ENUTransform;

                const rx = x * m[0] + y * m[4] + z * m[8] + m[12];
                const ry = x * m[1] + y * m[5] + z * m[9] + m[13];
                const rz = x * m[2] + y * m[6] + z * m[10] + m[14];

                x = rx;
                y = ry;
                z = rz;
            }
            target.x = x;
            target.y = y;
            target.z = z;
        }
    }
}
