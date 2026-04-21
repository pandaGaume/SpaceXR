import { Angle, Timespan } from "core/math/math.units";
import { Scalar } from "core/math/math";

/**
 * Parameters describing the orientation and spin of a body's rotation axis,
 * following the IAU WGCCRE convention: the pole direction is given as a
 * right-ascension / declination pair in the ICRS equatorial J2000 frame, and
 * the prime meridian is described by an offset W0 plus an angular rate Wdot.
 * Optional ...DotT terms model a small linear drift per Julian century.
 */
export interface IAxialTiltParams {
    /** Pole right ascension at J2000 (deg). */
    alpha0: number;
    /** Pole declination at J2000 (deg). */
    delta0: number;
    /** Prime-meridian angle at J2000 (deg). */
    W0: number;
    /** Prime-meridian angular speed (deg / day). Negative = retrograde. */
    Wdot: number;
    /** Linear drift of alpha0 per Julian century (deg). */
    alpha0DotT?: number;
    /** Linear drift of delta0 per Julian century (deg). */
    delta0DotT?: number;
}

/**
 * Full rotational-element descriptor for a celestial body.
 *
 * Replaces the earlier obliquity + period shorthand: knowing only an angle
 * and a sidereal period is insufficient to locate the rotation axis in a
 * reference frame or to know where the prime meridian points at a given
 * instant. This class keeps the IAU WGCCRE inputs and exposes the older
 * `obliquity` / `period` quantities as derived getters.
 */
export class AxialTilt {
    public static readonly defaultAngleUnit = Angle.Units.d;
    public static readonly defaultPeriodUnit = Timespan.Units.s;

    /** J2000 obliquity of the ecliptic relative to the ICRS equator (deg). */
    public static readonly EclipticObliquityJ2000 = 23.4392911;

    public readonly alpha0: number;
    public readonly alpha0DotT: number;
    public readonly delta0: number;
    public readonly delta0DotT: number;
    public readonly W0: number;
    public readonly Wdot: number;

    public constructor(params: IAxialTiltParams) {
        this.alpha0 = params.alpha0;
        this.delta0 = params.delta0;
        this.W0 = params.W0;
        this.Wdot = params.Wdot;
        this.alpha0DotT = params.alpha0DotT ?? 0;
        this.delta0DotT = params.delta0DotT ?? 0;
    }

    /**
     * Angle between this spin axis and the ecliptic J2000 north pole.
     * Derived from (alpha0, delta0) — returned as a positive angle.
     */
    public get obliquity(): Angle {
        const eps = AxialTilt.EclipticObliquityJ2000 * Scalar.DEG2RAD;
        const alpha = this.alpha0 * Scalar.DEG2RAD;
        const delta = this.delta0 * Scalar.DEG2RAD;
        // Spin-axis unit vector in ecliptic J2000 (z component only is needed).
        const yEq = Math.cos(delta) * Math.sin(alpha);
        const zEq = Math.sin(delta);
        const zEcl = -yEq * Math.sin(eps) + zEq * Math.cos(eps);
        const clamped = Math.max(-1, Math.min(1, zEcl));
        return new Angle(Math.acos(clamped) * Scalar.RAD2DEG, AxialTilt.defaultAngleUnit);
    }

    /**
     * Sidereal rotation period derived from |Wdot|, in seconds.
     * Retrograde spins (negative Wdot) still yield a positive period.
     */
    public get period(): Timespan {
        const secondsPerRotation = (360 / Math.abs(this.Wdot)) * 86400;
        return new Timespan(secondsPerRotation, AxialTilt.defaultPeriodUnit);
    }

    /** Signed mean angular speed, in deg/day (matches Wdot). */
    public get meanAngularSpeed(): number {
        return this.Wdot;
    }
}
