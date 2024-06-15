import { GeodeticSystem, IGeoProcessor } from "../../geodesy";
import { SphericalCalculator } from "../../geodesy/calculators/geodesy.calculator.spherical";
import { CalculatorBase } from "../../geodesy/geodesy.calculators";
import { Envelope } from "../geography.envelope";
import { IEnvelope, IGeo2, IsLocation } from "../geography.interfaces";
import { Geo2 } from "../geography.position";
import { AbstractShape } from "./geography.shape";
import { IGeoCircle, ShapeType } from "./geography.shapes.interfaces";

export class GeoCircle extends AbstractShape implements IGeoCircle {
    _center: IGeo2;
    _radius: number;

    public constructor(lat: IGeo2 | number, lon: number, radius: number, s?: GeodeticSystem, proc?: IGeoProcessor) {
        super(ShapeType.Circle, s, proc);
        this._center = IsLocation(lat) ? lat : new Geo2(lat, lon);
        this._radius = radius;
    }

    public get center(): IGeo2 {
        return this._center;
    }

    public set center(v: IGeo2) {
        if (!this._center.equals(v)) {
            this._center = v;
            this.invalidateEnvelope();
        }
    }

    public get radius(): number {
        return this._radius;
    }

    public set radius(v: number) {
        if (this._radius !== v) {
            this._radius = v;
            this.invalidateEnvelope();
        }
    }

    protected _buildEnvelope(): IEnvelope | undefined {
        const calculator = this.processor ?? CalculatorBase.Shared ?? SphericalCalculator.Shared;
        const r = this._radius;
        const lat = this._center.lat;
        const lon = this._center.lon;
        const N = calculator.getLocationAtDistanceAzimuth(lat, lon, r, 0);
        const E = calculator.getLocationAtDistanceAzimuth(lat, lon, r, 90);
        const S = calculator.getLocationAtDistanceAzimuth(lat, lon, r, 180);
        const W = calculator.getLocationAtDistanceAzimuth(lat, lon, r, 270);
        return Envelope.FromPoints(N, E, S, W);
    }
}
