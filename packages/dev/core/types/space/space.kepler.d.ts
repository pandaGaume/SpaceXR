import { Distance, Angle, Timespan, Speed } from "../math/math.units";
import { IKeplerOrbit, ICelestialBody } from "./space.interfaces";
export declare class KeplerOrbitBase implements IKeplerOrbit {
    static DefaultDecimalPrecision: number;
    static DefaultIterationLimit: number;
    protected _body: ICelestialBody;
    protected _focus: ICelestialBody;
    protected _semiMajorAxis: Distance;
    protected _eccentricity: number;
    protected _periapsisTime: number;
    protected _periapsisAngle: Angle;
    protected _inclination: Angle;
    protected _ascendingNodeLongitude: Angle;
    protected _period: Timespan;
    protected constructor(body: ICelestialBody, focus: ICelestialBody, semiMajorAxis: Distance | number, eccentricity: number | undefined, periapsisTime: number | undefined, inclination: Angle | number, ascendingNodeLongitude: Angle | number, periapsisAngle: Angle | number, period: Timespan | number);
    get body(): ICelestialBody;
    get focus(): ICelestialBody;
    get semiMajorAxis(): Distance;
    get semiMinorAxis(): Distance;
    get periapsis(): Distance;
    get periapsisTime(): number;
    get periapsisAngle(): Angle;
    get inclination(): Timespan;
    get period(): Timespan;
    get apoapsis(): Distance;
    get meanAngularSpeed(): Speed;
    getEccentricAnomaly(meanAnomaly: number, decimalPrecision: number): Distance;
}
