import { Scalar } from "../../math/math";

export class HorizonVector {
    public distance?: number;
    public parallacticAngle?: number;

    public constructor(public azimuth: number, public altitude: number) {}
}

/// Right Ascension (RA): Analogous to longitude on Earth, Right Ascension measures the east-west position of a celestial object.
/// It is expressed in terms of hours, minutes, and seconds, where 24 hours equals a full 360-degree circle.
/// RA is measured eastward along the celestial equator from the vernal equinox.
/// Declination (Dec): Similar to latitude on Earth, Declination measures the north-south position of a celestial object.
/// It is expressed in degrees, where positive values indicate north of the celestial equator and negative values indicate south.
/// The range of declination is from +90 degrees at the celestial north pole to -90 degrees at the celestial south pole.
export class EquatorialVector {
    public distance?: number;

    public constructor(public rightAscension: number, public declination: number) {}
}

export class MoonState {
    public constructor(public fraction: number, public phase: number, public angle: number) {}
}

export class SunTrajectoryConfig {
    public constructor(public angle: number, public riseName: string, public setName: string) {}
}

export class JulianDate {
    public static DayMs = 1000 * 60 * 60 * 24;
    public static J1970 = 2440588;
    public static J2000 = 2451545;
    public static J0 = 0.0009;

    public static JulianCycle(d: number, lw: number): number {
        return Math.round(d - JulianDate.J0 - lw / (2 * Math.PI));
    }

    public static FromDate(date: Date): JulianDate {
        return new JulianDate(date.valueOf() / JulianDate.DayMs - 0.5 + JulianDate.J1970);
    }

    public static ToDate(julian: number): Date {
        return new Date((julian + 0.5 - JulianDate.J1970) * JulianDate.DayMs);
    }

    private _value: number;

    protected constructor(value: number) {
        this._value = value;
    }

    public get value(): number {
        return this._value;
    }

    public toDate(): Date {
        return new Date((this._value + 0.5 - JulianDate.J1970) * JulianDate.DayMs);
    }

    public toDays(): number {
        return this._value - JulianDate.J2000;
    }
}

/// CelestialTracker is a collection of functions to calculate the position of the sun and the moon in the sky of the earth
/// based on js lib suncalc.js by Vladimir Agafonkin. https://github.com/mourner/suncalc

export class CelestialTracker {
    public static EarthObliquity = Scalar.DEG2RAD * 23.4397;
    public static EarthObliquity_Sin = Math.sin(CelestialTracker.EarthObliquity);
    public static EarthObliquity_Cos = Math.cos(CelestialTracker.EarthObliquity);

    public static SunTrajectories: SunTrajectoryConfig[] = [
        new SunTrajectoryConfig(-0.833, "sunrise", "sunset"),
        new SunTrajectoryConfig(-0.3, "sunriseEnd", "sunsetStart"),
        new SunTrajectoryConfig(-6, "dawn", "dusk"),
        new SunTrajectoryConfig(-12, "nauticalDawn", "nauticalDusk"),
        new SunTrajectoryConfig(-18, "nightEnd", "night"),
        new SunTrajectoryConfig(6, "goldenHourEnd", "goldenHour"),
    ];

    private static _ApproxTransit(Ht: number, lw: number, n: number): number {
        return JulianDate.J0 + (Ht + lw) / (2 * Math.PI) + n;
    }
    private static _SolarTransitJ(ds: number, M: number, L: number): number {
        return JulianDate.J2000 + ds + 0.0053 * Math.sin(M) - 0.0069 * Math.sin(2 * L);
    }

    private static _HourAngle(h: number, phi: number, d: number): number {
        return Math.acos((Math.sin(h) - Math.sin(phi) * Math.sin(d)) / (Math.cos(phi) * Math.cos(d)));
    }
    private static _ObserverAngle(height: number): number {
        return (-2.076 * Math.sqrt(height)) / 60;
    }

    // returns set time for the given sun altitude
    private static _GetSetJ(h: number, lw: number, phi: number, dec: number, n: number, M: number, L: number): number {
        var w = CelestialTracker._HourAngle(h, phi, dec),
            a = CelestialTracker._ApproxTransit(w, lw, n);
        return CelestialTracker._SolarTransitJ(a, M, L);
    }

    public static Azimuth(H: number, phi: number, dec: number): number {
        return Math.atan2(Math.sin(H), Math.cos(H) * Math.sin(phi) - Math.tan(dec) * Math.cos(phi));
    }

    public static Altitude(H: number, phi: number, dec: number): number {
        return Math.asin(Math.sin(phi) * Math.sin(dec) + Math.cos(phi) * Math.cos(dec) * Math.cos(H));
    }

    public static SiderealTime(d: number, lw: number): number {
        return Scalar.DEG2RAD * (280.16 + 360.9856235 * d) - lw;
    }

    public static Declination(l: number, b: number): number {
        return Math.asin(Math.sin(b) * CelestialTracker.EarthObliquity_Cos + Math.sin(l) * CelestialTracker.EarthObliquity_Sin * Math.cos(b));
    }

    public static RightAscension(l: number, b: number): number {
        return Math.atan2(Math.sin(l) * CelestialTracker.EarthObliquity_Cos - Math.tan(b) * CelestialTracker.EarthObliquity_Sin, Math.cos(l));
    }

    public static EclipticLongitude(M: number): number {
        const C = Scalar.DEG2RAD * (1.9148 * Math.sin(M) + 0.02 * Math.sin(2 * M) + 0.0003 * Math.sin(3 * M));
        const P = Scalar.DEG2RAD * 102.9372;
        return M + C + P + Math.PI;
    }

    public static SolarMeanAnomaly(d: number): number {
        return Scalar.DEG2RAD * (357.5291 + 0.98560028 * d);
    }

    public static SunCoords(d: number): EquatorialVector {
        const M = CelestialTracker.SolarMeanAnomaly(d);
        const L = CelestialTracker.EclipticLongitude(M);
        return new EquatorialVector(CelestialTracker.RightAscension(L, 0), CelestialTracker.Declination(L, 0));
    }

    // calculates sun times for a given date, latitude/longitude, and, optionally,
    // the observer height (in meters) relative to the horizon

    public static GetSunTimes(date: Date, lat: number, lng: number, height: number): any {
        height = height || 0;

        const lw = Scalar.DEG2RAD * -lng;
        const phi = Scalar.DEG2RAD * lat;
        const dh = CelestialTracker._ObserverAngle(height);
        const d = JulianDate.FromDate(date).toDays();
        const n = JulianDate.JulianCycle(d, lw);
        const ds = CelestialTracker._ApproxTransit(0, lw, n);
        const M = CelestialTracker.SolarMeanAnomaly(ds);
        const L = CelestialTracker.EclipticLongitude(M);
        const dec = CelestialTracker.Declination(L, 0);
        const Jnoon = CelestialTracker._SolarTransitJ(ds, M, L);

        var result: any = {
            solarNoon: JulianDate.ToDate(Jnoon),
            nadir: JulianDate.ToDate(Jnoon - 0.5),
        };

        const times = CelestialTracker.SunTrajectories;

        for (let i = 0, len = times.length; i < len; i += 1) {
            const time = times[i];
            const h0 = (time.angle + dh) * Scalar.DEG2RAD;

            const Jset = CelestialTracker._GetSetJ(h0, lw, phi, dec, n, M, L);
            const Jrise = Jnoon - (Jset - Jnoon);

            result[time.riseName] = JulianDate.ToDate(Jrise);
            result[time.setName] = JulianDate.ToDate(Jset);
        }

        return result;
    }

    public static GetSunPosition(date: Date, lat: number, lon: number): HorizonVector {
        const lw = -lon * Scalar.DEG2RAD;
        const phi = lat * Scalar.DEG2RAD;
        const d = JulianDate.FromDate(date).toDays();

        const c = CelestialTracker.SunCoords(d);
        const H = CelestialTracker.SiderealTime(d, lw) - c.rightAscension;

        return new HorizonVector(CelestialTracker.Azimuth(H, phi, c.declination), CelestialTracker.Altitude(H, phi, c.declination));
    }

    // moon calculations, based on http://aa.quae.nl/en/reken/hemelpositie.html formulas
    private static _MoonCoords(d: number): EquatorialVector {
        // geocentric ecliptic coordinates of the moon
        const L = Scalar.DEG2RAD * (218.316 + 13.176396 * d); // ecliptic longitude
        const M = Scalar.DEG2RAD * (134.963 + 13.064993 * d); // mean anomaly
        const F = Scalar.DEG2RAD * (93.272 + 13.22935 * d); // mean distance

        const l = L + Scalar.DEG2RAD * 6.289 * Math.sin(M); // longitude
        const b = Scalar.DEG2RAD * 5.128 * Math.sin(F); // latitude
        const dt = 385001 - 20905 * Math.cos(M); // distance to the moon in km

        const v = new EquatorialVector(CelestialTracker.RightAscension(l, b), CelestialTracker.Declination(l, b));
        v.distance = dt;
        return v;
    }

    private static _AstroRefraction(h: number): number {
        if (h < 0)
            // the following formula works for positive altitudes only.
            h = 0; // if h = -0.08901179 a div/0 would occur.

        // formula 16.4 of "Astronomical Algorithms" 2nd edition by Jean Meeus (Willmann-Bell, Richmond) 1998.
        // 1.02 / tan(h + 10.26 / (h + 5.10)) h in degrees, result in arc minutes -> converted to rad:
        return 0.0002967 / Math.tan(h + 0.00312536 / (h + 0.08901179));
    }

    public static GetMoonPosition(date: Date, lat: number, lon: number): HorizonVector {
        const lw = -lon * Scalar.DEG2RAD;
        const phi = lat * Scalar.DEG2RAD;
        const d = JulianDate.FromDate(date).toDays();

        const c = CelestialTracker._MoonCoords(d);
        const H = CelestialTracker.SiderealTime(d, lw) - c.rightAscension;
        let h = CelestialTracker.Altitude(H, phi, c.declination);
        // formula 14.1 of "Astronomical Algorithms" 2nd edition by Jean Meeus (Willmann-Bell, Richmond) 1998.
        const pa = Math.atan2(Math.sin(H), Math.tan(phi) * Math.cos(c.declination) - Math.sin(c.declination) * Math.cos(H));

        h = h + CelestialTracker._AstroRefraction(h); // altitude correction for refraction

        const v = new HorizonVector(CelestialTracker.Azimuth(H, phi, c.declination), h);
        v.distance = c.distance;
        v.parallacticAngle = pa;
        return v;
    }

    // calculations for illumination parameters of the moon,
    // based on http://idlastro.gsfc.nasa.gov/ftp/pro/astro/mphase.pro formulas and
    // Chapter 48 of "Astronomical Algorithms" 2nd edition by Jean Meeus (Willmann-Bell, Richmond) 1998.
    public static GetMoonIllumination = function (date: Date): MoonState {
        const d = JulianDate.FromDate(date).toDays();
        const s = CelestialTracker.SunCoords(d);
        const m = CelestialTracker._MoonCoords(d);
        const sdist = 149598000; // distance from Earth to Sun in km
        const phi = Math.acos(
            Math.sin(s.declination) * Math.sin(m.declination) + Math.cos(s.declination) * Math.cos(m.declination) * Math.cos(s.rightAscension - m.rightAscension)
        );
        const inc = Math.atan2(sdist * Math.sin(phi), m.distance! - sdist * Math.cos(phi));
        const angle = Math.atan2(
            Math.cos(s.declination) * Math.sin(s.rightAscension - m.rightAscension),
            Math.sin(s.declination) * Math.cos(m.declination) - Math.cos(s.declination) * Math.sin(m.declination) * Math.cos(s.rightAscension - m.rightAscension)
        );

        return new MoonState(1 + Math.cos(inc), 0.5 + (0.5 * inc * (angle < 0 ? -1 : 1)) / Math.PI, angle);
    };

    private static _HoursLater(date: Date, h: number) {
        return new Date(date.valueOf() + (h * JulianDate.DayMs) / 24);
    }

    // calculations for moon rise/set times are based on http://www.stargazing.net/kepler/moonrise.html article

    public static GetMoonTimes = function (date: Date, lat: number, lng: number, inUTC: boolean): any {
        var t = new Date(date);
        if (inUTC) t.setUTCHours(0, 0, 0, 0);
        else t.setHours(0, 0, 0, 0);

        const hc = 0.133 * Scalar.DEG2RAD;
        let h0 = CelestialTracker.GetMoonPosition(t, lat, lng).altitude - hc;

        let rise, set, ye;

        // go in 2-hour chunks, each time seeing if a 3-point quadratic curve crosses zero (which means rise or set)
        for (var i = 1; i <= 24; i += 2) {
            const h1 = CelestialTracker.GetMoonPosition(CelestialTracker._HoursLater(t, i), lat, lng).altitude - hc;
            const h2 = CelestialTracker.GetMoonPosition(CelestialTracker._HoursLater(t, i + 1), lat, lng).altitude - hc;

            const a = (h0 + h2) / 2 - h1;
            const b = (h2 - h0) / 2;
            const xe = -b / (2 * a);
            ye = (a * xe + b) * xe + h1;
            const d = b * b - 4 * a * h1;
            let roots = 0;
            let x1 = 0;
            let x2 = 0;

            if (d >= 0) {
                const dx = Math.sqrt(d) / (Math.abs(a) * 2);
                x1 = xe - dx;
                x2 = xe + dx;
                if (Math.abs(x1) <= 1) roots++;
                if (Math.abs(x2) <= 1) roots++;
                if (x1 < -1) x1 = x2;
            }

            if (roots === 1) {
                if (h0 < 0) rise = i + x1;
                else set = i + x1;
            } else if (roots === 2) {
                rise = i + (ye < 0 ? x2 : x1);
                set = i + (ye < 0 ? x1 : x2);
            }

            if (rise && set) break;

            h0 = h2;
        }

        var result: any = {};

        if (rise) result.rise = CelestialTracker._HoursLater(t, rise);
        if (set) result.set = CelestialTracker._HoursLater(t, set);

        if (!rise && !set) result[ye && ye > 0 ? "alwaysUp" : "alwaysDown"] = true;

        return result;
    };
}
