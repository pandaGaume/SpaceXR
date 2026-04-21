import { Cartesian3, ICartesian3 } from "core/geometry";
import { Scalar } from "core/math/math";

import { AxialTilt } from "../space.axialTilt";
import { CelestialNodeType } from "../space.interfaces";
import { IOrbitalElements } from "../space.bodies";
import { SolarSystemBodies } from "../space.solarSystem";
import { JulianDate } from "./space.celestialTracker";

/**
 * Heliocentric pose of a single solar-system body at a given UTC instant.
 *
 * Reference frame: J2000 mean ecliptic. +X toward the vernal equinox, +Z along
 * the ecliptic north pole, +Y completing the right-handed triad. Positions are
 * in km, rotation is in radians.
 */
export interface IBodyEphemeris {
    name: string;
    celestialType: CelestialNodeType;
    /** Heliocentric position in the ecliptic J2000 frame, in km. */
    position: ICartesian3;
    /** Unit vector of the body's north spin axis in the ecliptic J2000 frame. */
    tilt: ICartesian3;
    /** Prime-meridian angle around the tilt axis, in radians (0..2pi). */
    rotation: number;
}

const AU_KM = 149597870.7;
const J2000_OBLIQUITY_RAD = 23.4392911 * Scalar.DEG2RAD;

/** Newton-Raphson solver for Kepler's equation M = E - e sin(E). Radians in, radians out. */
function solveKepler(M: number, e: number, tolerance = 1e-8, maxIter = 30): number {
    let E = e < 0.8 ? M : Math.PI;
    for (let i = 0; i < maxIter; i++) {
        const f = E - e * Math.sin(E) - M;
        const dE = f / (1 - e * Math.cos(E));
        E -= dE;
        if (Math.abs(dE) < tolerance) break;
    }
    return E;
}

function wrapAngle(rad: number): number {
    const twoPi = 2 * Math.PI;
    return ((rad % twoPi) + twoPi) % twoPi;
}

/**
 * Solve an elliptical Keplerian orbit and return the (x, y, z) vector in the
 * orbit's reference plane. `distanceScale` converts the length units of `a`
 * into kilometers: AU_KM for heliocentric planet orbits, 1 for satellite
 * orbits where `a` is already in km.
 *
 * For planets the returned vector lives in the ecliptic J2000 frame.
 * For satellites it lives in the parent's equatorial frame and still needs a
 * final rotation to ecliptic.
 */
function computeKeplerianPosition(el: IOrbitalElements, T: number, distanceScale: number): ICartesian3 {
    const a = el.a + el.aDot * T;
    const e = el.e + el.eDot * T;
    const I = (el.I + el.IDot * T) * Scalar.DEG2RAD;
    const L = (el.L + el.LDot * T) * Scalar.DEG2RAD;
    const varpi = (el.varpi + el.varpiDot * T) * Scalar.DEG2RAD;
    const Omega = (el.Omega + el.OmegaDot * T) * Scalar.DEG2RAD;
    const omega = varpi - Omega;

    let M = L - varpi;
    M = ((M % (2 * Math.PI)) + 3 * Math.PI) % (2 * Math.PI) - Math.PI;
    const E = solveKepler(M, e);

    const xp = a * (Math.cos(E) - e);
    const yp = a * Math.sqrt(1 - e * e) * Math.sin(E);

    const cw = Math.cos(omega);
    const sw = Math.sin(omega);
    const cO = Math.cos(Omega);
    const sO = Math.sin(Omega);
    const cI = Math.cos(I);
    const sI = Math.sin(I);

    const x = (cw * cO - sw * sO * cI) * xp + (-sw * cO - cw * sO * cI) * yp;
    const y = (cw * sO + sw * cO * cI) * xp + (-sw * sO + cw * cO * cI) * yp;
    const z = sw * sI * xp + cw * sI * yp;

    return new Cartesian3(x * distanceScale, y * distanceScale, z * distanceScale);
}

/**
 * Geocentric lunar position in the ecliptic J2000 frame, in km.
 * Low-precision Meeus / SunCalc series, ~0.3 degree longitude accuracy.
 */
function computeMoonGeocentric(d: number): ICartesian3 {
    const L = Scalar.DEG2RAD * (218.316 + 13.176396 * d);
    const M = Scalar.DEG2RAD * (134.963 + 13.064993 * d);
    const F = Scalar.DEG2RAD * (93.272 + 13.22935 * d);

    const lambda = L + Scalar.DEG2RAD * 6.289 * Math.sin(M);
    const beta = Scalar.DEG2RAD * 5.128 * Math.sin(F);
    const dist = 385001 - 20905 * Math.cos(M);

    const cb = Math.cos(beta);
    return new Cartesian3(dist * cb * Math.cos(lambda), dist * cb * Math.sin(lambda), dist * Math.sin(beta));
}

/** Unit vector of the body's spin axis in the ecliptic J2000 frame. */
function computeTiltAxis(tilt: AxialTilt, T: number): ICartesian3 {
    const alpha = (tilt.alpha0 + tilt.alpha0DotT * T) * Scalar.DEG2RAD;
    const delta = (tilt.delta0 + tilt.delta0DotT * T) * Scalar.DEG2RAD;
    const xEq = Math.cos(delta) * Math.cos(alpha);
    const yEq = Math.cos(delta) * Math.sin(alpha);
    const zEq = Math.sin(delta);
    const ce = Math.cos(J2000_OBLIQUITY_RAD);
    const se = Math.sin(J2000_OBLIQUITY_RAD);
    return new Cartesian3(xEq, yEq * ce + zEq * se, -yEq * se + zEq * ce);
}

function computeRotationAngle(tilt: AxialTilt, d: number): number {
    return wrapAngle((tilt.W0 + tilt.Wdot * d) * Scalar.DEG2RAD);
}

/**
 * Rotate a position vector from the parent body's equatorial frame into the
 * ecliptic J2000 frame, using the parent pole's (alpha0, delta0) direction.
 * Composed as Rx(-epsilonJ2000) * Rz(alpha + pi/2) * Rx(pi/2 - delta).
 */
function rotateParentEquatorialToEcliptic(pos: ICartesian3, tilt: AxialTilt, T: number): ICartesian3 {
    const alpha = (tilt.alpha0 + tilt.alpha0DotT * T) * Scalar.DEG2RAD;
    const delta = (tilt.delta0 + tilt.delta0DotT * T) * Scalar.DEG2RAD;

    const halfPi = Math.PI / 2;
    const c1 = Math.cos(halfPi - delta);
    const s1 = Math.sin(halfPi - delta);
    const c2 = Math.cos(alpha + halfPi);
    const s2 = Math.sin(alpha + halfPi);
    const ce = Math.cos(J2000_OBLIQUITY_RAD);
    const se = Math.sin(J2000_OBLIQUITY_RAD);

    // Rx(pi/2 - delta) — tilts the parent equator up by (pi/2 - delta) around X.
    const x1 = pos.x;
    const y1 = pos.y * c1 - pos.z * s1;
    const z1 = pos.y * s1 + pos.z * c1;

    // Rz(alpha + pi/2) — swings the ascending node to the ICRS node.
    const x2 = x1 * c2 - y1 * s2;
    const y2 = x1 * s2 + y1 * c2;
    const z2 = z1;

    // Rx(-epsilon_J2000) — ICRS equatorial -> ecliptic J2000.
    return new Cartesian3(x2, y2 * ce + z2 * se, -y2 * se + z2 * ce);
}

/**
 * Compute heliocentric ephemerides for every body in {@link SolarSystemBodies}
 * that has enough data to be fully resolved (a {@link AxialTilt} plus either a
 * heliocentric orbit, or a parent for which the parent-relative theory is known).
 *
 * - Planet positions use the JPL / Standish low-precision Keplerian elements
 *   stored on each body's `orbit` field.
 * - The Moon's heliocentric position is Earth's position plus a low-precision
 *   geocentric Meeus series.
 * - Tilt axis and prime-meridian angle come from the {@link AxialTilt} on
 *   each body (linear IAU WGCCRE terms only). Bodies without a `tilt` are skipped.
 *
 * Returned order matches the insertion order of {@link SolarSystemBodies}.
 */
export function computeSolarSystemEphemeris(utc: Date): IBodyEphemeris[] {
    const d = JulianDate.FromDate(utc).toDays();
    const T = d / 36525;

    const positions: Record<string, ICartesian3> = {};

    // First pass: primaries. Bodies with an orbit live in heliocentric ecliptic;
    // bodies with neither orbit nor parent (the Sun) sit at the origin.
    for (const body of Object.values(SolarSystemBodies)) {
        if (body.parent) continue;
        positions[body.name] = body.orbit ? computeKeplerianPosition(body.orbit, T, AU_KM) : new Cartesian3(0, 0, 0);
    }

    // Second pass: satellites.
    // - Earth's Moon uses the Meeus low-precision series (more accurate than
    //   a plain Keplerian at that scale).
    // - All other satellites with an `orbit` field run a Keplerian solve in the
    //   parent's equatorial plane (a is in km, I is measured from the parent
    //   equator), then rotate into the ecliptic J2000 frame using the parent's
    //   pole orientation before adding the parent's heliocentric position.
    for (const body of Object.values(SolarSystemBodies)) {
        if (!body.parent) continue;
        const parentBody = SolarSystemBodies[body.parent];
        const parentPos = positions[body.parent];
        if (!parentBody || !parentPos) continue;

        if (body.name === "Moon") {
            const moonGeo = computeMoonGeocentric(d);
            positions.Moon = new Cartesian3(parentPos.x + moonGeo.x, parentPos.y + moonGeo.y, parentPos.z + moonGeo.z);
            continue;
        }

        if (body.orbit && parentBody.tilt) {
            const local = computeKeplerianPosition(body.orbit, T, 1);
            const offset = rotateParentEquatorialToEcliptic(local, parentBody.tilt, T);
            positions[body.name] = new Cartesian3(parentPos.x + offset.x, parentPos.y + offset.y, parentPos.z + offset.z);
        }
    }

    const result: IBodyEphemeris[] = [];
    for (const body of Object.values(SolarSystemBodies)) {
        if (!body.tilt) continue;
        const pos = positions[body.name];
        if (!pos) continue;
        result.push({
            name: body.name,
            celestialType: body.celestialType,
            position: pos,
            tilt: computeTiltAxis(body.tilt, T),
            rotation: computeRotationAngle(body.tilt, d),
        });
    }
    return result;
}

/** Same as {@link computeSolarSystemEphemeris} but returns a single body by name. */
export function computeBodyEphemeris(name: string, utc: Date): IBodyEphemeris | undefined {
    return computeSolarSystemEphemeris(utc).find((b) => b.name === name);
}
