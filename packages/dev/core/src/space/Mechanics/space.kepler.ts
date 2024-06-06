import { Length, Angle, Timespan, Speed } from "../../math/math.units";
import { IKeplerOrbit, ICelestialBody } from "../space.interfaces";

export class KeplerOrbitBase implements IKeplerOrbit {
    public static DefaultDecimalPrecision = 5;
    public static DefaultIterationLimit = 30; // be conservative...

    protected _body: ICelestialBody;
    protected _focus: ICelestialBody;

    protected _semiMajorAxis: Length;
    protected _eccentricity: number;
    protected _periapsisTime: number;
    protected _periapsisAngle: Angle;
    protected _inclination: Angle;
    protected _ascendingNodeLongitude: Angle;
    protected _period: Timespan;

    protected constructor(
        body: ICelestialBody,
        focus: ICelestialBody,
        semiMajorAxis: Length | number,
        eccentricity = 0,
        periapsisTime = 0,
        inclination: Angle | number,
        ascendingNodeLongitude: Angle | number,
        periapsisAngle: Angle | number,
        period: Timespan | number
    ) {
        this._body = body;
        this._focus = focus;
        this._semiMajorAxis = new Length(semiMajorAxis, Length.Units.Ly);
        this._eccentricity = eccentricity;
        this._periapsisTime = periapsisTime;
        this._inclination = new Angle(inclination, Angle.Units.d);
        this._ascendingNodeLongitude = new Angle(ascendingNodeLongitude, Angle.Units.d);
        this._periapsisAngle = new Angle(periapsisAngle, Angle.Units.d);
        this._period = new Timespan(period, Timespan.Units.Yr);
    }

    public get body(): ICelestialBody {
        return this._body;
    }

    public get focus(): ICelestialBody {
        return this._focus;
    }

    public get semiMajorAxis(): Length {
        return this._semiMajorAxis;
    }

    public get semiMinorAxis(): Length {
        const v: number = this._semiMajorAxis.value * Math.sqrt(1.0 - this._eccentricity * this._eccentricity);
        return new Length(v, this._semiMajorAxis.unit);
    }

    public get periapsis(): Length {
        const v: number = this.semiMajorAxis.value * (1.0 - this._eccentricity);
        return new Length(v, this._semiMajorAxis.unit);
    }

    public get periapsisTime(): number {
        return this._periapsisTime;
    }
    public get periapsisAngle(): Angle {
        return this._periapsisAngle;
    }
    public get inclination(): Timespan {
        return this._inclination;
    }

    public get period(): Timespan {
        return this._period;
    }

    public get apoapsis(): Length {
        const v: number = this.semiMajorAxis.value * (1.0 + this._eccentricity);
        return new Length(v, this._semiMajorAxis.unit);
    }

    public get meanAngularSpeed(): Speed {
        return new Speed(360.0 / this._period.value);
    }

    /**
     * Kepler's equation cannot be solved algebraically. It can be treated by an iteration methods.
     * One of them is Newton's method, finding roots of f(E) = E - e*sin(E) - M(t)
     * @param meanAnomaly
     * @param decimalPrecision
     */
    public getEccentricAnomaly(meanAnomaly: number, decimalPrecision: number): Length {
        const dp: number = decimalPrecision || KeplerOrbitBase.DefaultDecimalPrecision;
        const K: number = Math.PI / 180.0;
        let m: number = meanAnomaly / 360.0;
        m = 2.0 * Math.PI * (m - Math.floor(m));
        let E: number = this._eccentricity < 0.8 ? m : Math.PI;

        // initialize
        let F: number = E - this._eccentricity * Math.sin(m) - m;

        // iterations limits.
        const maxIteration: number = KeplerOrbitBase.DefaultIterationLimit;
        const delta: number = Math.pow(10, -dp);

        let i = 0;
        while (Math.abs(F) > delta && i++ < maxIteration) {
            E -= F / (1.0 - this._eccentricity * Math.cos(E));
            F = E - this._eccentricity * Math.sin(E) - m;
        }

        E /= K;

        return new Length(Math.round(E * Math.pow(10, dp)) / Math.pow(10, dp));
    }
}
