export declare class HorizonVector {
    azimuth: number;
    altitude: number;
    distance?: number;
    parallacticAngle?: number;
    constructor(azimuth: number, altitude: number);
}
export declare class EquatorialVector {
    rightAscension: number;
    declination: number;
    distance?: number;
    constructor(rightAscension: number, declination: number);
}
export declare class MoonState {
    fraction: number;
    phase: number;
    angle: number;
    constructor(fraction: number, phase: number, angle: number);
}
export declare class SunTrajectoryConfig {
    angle: number;
    riseName: string;
    setName: string;
    constructor(angle: number, riseName: string, setName: string);
}
export declare class JulianDate {
    static DayMs: number;
    static J1970: number;
    static J2000: number;
    static J0: number;
    static JulianCycle(d: number, lw: number): number;
    static FromDate(date: Date): JulianDate;
    static ToDate(julian: number): Date;
    private _value;
    protected constructor(value: number);
    get value(): number;
    toDate(): Date;
    toDays(): number;
}
export declare class CelestialTracker {
    private static EarthObliquity;
    private static EarthObliquity_Sin;
    private static EarthObliquity_Cos;
    static SunTrajectories: SunTrajectoryConfig[];
    private static ApproxTransit;
    private static SolarTransitJ;
    private static HourAngle;
    private static ObserverAngle;
    private static GetSetJ;
    static Azimuth(H: number, phi: number, dec: number): number;
    static Altitude(H: number, phi: number, dec: number): number;
    static SiderealTime(d: number, lw: number): number;
    static Declination(l: number, b: number): number;
    static RightAscension(l: number, b: number): number;
    static EclipticLongitude(M: number): number;
    static SolarMeanAnomaly(d: number): number;
    static SunCoords(d: number): EquatorialVector;
    static GetSunTimes(date: Date, lat: number, lng: number, height: number): any;
    static GetSunPosition(date: Date, lat: number, lon: number): HorizonVector;
    private static MoonCoords;
    private static AstroRefraction;
    static GetMoonPosition(date: Date, lat: number, lon: number): HorizonVector;
    static GetMoonIllumination: (date: Date) => MoonState;
    private static HoursLater;
    static GetMoonTimes: (date: Date, lat: number, lng: number, inUTC: boolean) => any;
}
