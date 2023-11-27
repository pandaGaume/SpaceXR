import { GeodeticSystem } from "../geodesy/geodesy.system";
import { Envelope, GeoBounded } from "./geography.envelope";
import { IEnvelope } from "./geography.interfaces";

export abstract class AbstractShape extends GeoBounded {
    _system: GeodeticSystem;

    public constructor(s?: GeodeticSystem) {
        super();
        this._system = s ?? GeodeticSystem.Default;
    }

    public get system(): GeodeticSystem {
        return this._system;
    }

    public set system(v: GeodeticSystem) {
        if (this._system !== v) {
            this._system = v;
            this.invalidateEnvelope();
        }
    }

    protected abstract _buildEnvelope(): IEnvelope | undefined;
}

export class GeoCircle extends AbstractShape {
    public constructor(public lat: number, public lon: number, public radius: number) {
        super();
    }

    protected _buildEnvelope(): IEnvelope | undefined {
        const calculator = this.system.calculator ;
        const r = this.radius;
        const a = calculator.getLocationAtDistanceAzimuth(this.lat, this.lon, r, 0);
        const b = calculator.getLocationAtDistanceAzimuth(this.lat, this.lon, r, 90);
        const c = calculator.getLocationAtDistanceAzimuth(this.lat, this.lon, r, 180);
        const d = calculator.getLocationAtDistanceAzimuth(this.lat, this.lon, r, 270);
        return Envelope.FromPoints(a,b,c,d);
    }
}
