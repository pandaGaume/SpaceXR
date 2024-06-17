import { GeodeticSystem, IGeoProcessor } from "../../geodesy";
import { SphericalCalculator } from "../../geodesy/calculators/geodesy.calculator.spherical";
import { CalculatorBase } from "../../geodesy/geodesy.calculators";
import { Envelope } from "../geography.envelope";
import { IEnvelope, IGeo2 } from "../geography.interfaces";
import { GeoPolygon } from "./geography.polygon";
import { AbstractGeoShape } from "./geography.shape";
import { IGeoCircle, GeoShapeType, IGeoPolygon } from "./geography.shapes.interfaces";

export class GeoCircle extends AbstractGeoShape implements IGeoCircle {
    _center: IGeo2;
    _radius: number;

    public constructor(lat: IGeo2, radius: number, s?: GeodeticSystem, proc?: IGeoProcessor) {
        super(GeoShapeType.Circle, s, proc);
        this._center = lat;
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

    public toPolygon(step: number): IGeoPolygon {
        const points: Array<IGeo2> = [];
        const angle = 360 / step;
        const r = this._radius;
        const lat = this._center.lat;
        const lon = this._center.lon;
        for (let i = 0; i < 360; i += angle) {
            points.push(this.processor.getLocationAtDistanceAzimuth(lat, lon, r, i));
        }
        return new GeoPolygon(points, this.system, this.processor);
    }
}
