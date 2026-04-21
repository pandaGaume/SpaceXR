import { Ellipsoid } from "core/geodesy/geodesy.ellipsoid";
import { AxialTilt } from "./space.axialTilt";
import { CelestialNodeType } from "./space.interfaces";

/**
 * Mean orbital elements + per-century linear rates.
 *
 * For primary bodies (planets) these are JPL / Standish 1992 elements in the
 * J2000 ecliptic frame; `a` is in AU. For satellites they are given in the
 * parent body's equatorial plane; `a` is in km, `I` is measured from the
 * parent's equator, `Omega` is the longitude of the ascending node on that
 * equator (zero = parent-equatorial X axis), `L` is the mean longitude at
 * J2000. Angles are in degrees, `LDot` is in degrees / Julian century.
 */
export interface IOrbitalElements {
    /** Semi-major axis (AU for primaries, km for satellites). */
    a: number;
    aDot: number;
    /** Eccentricity. */
    e: number;
    eDot: number;
    /** Inclination (deg). */
    I: number;
    IDot: number;
    /** Mean longitude (deg). */
    L: number;
    LDot: number;
    /** Longitude of perihelion (deg). */
    varpi: number;
    varpiDot: number;
    /** Longitude of ascending node (deg). */
    Omega: number;
    OmegaDot: number;
}

/**
 * Data-level descriptor of any celestial body: stars, planets, moons, minor
 * bodies (asteroids, dwarf planets), and equally applicable to exoplanets or
 * satellites of other stars. Not restricted to our Solar System.
 *
 * This is the catalog/table shape consumed by the ephemeris and vendor
 * pipelines. It is distinct from the richer object-model interface
 * {@link ICelestialBody} in `space.interfaces.ts`, which describes a runtime
 * instance with geometry, material, atmosphere, etc.
 */
export interface ICelestialBodyDescriptor {
    readonly name: string;
    readonly celestialType: CelestialNodeType;
    readonly ellipsoid: Ellipsoid;
    readonly meanRadiusKm: number;
    /** Surface gravity in m/s^2 */
    readonly surfaceGravity: number;
    /** Name of the parent body for satellites (e.g. "Earth" for the Moon). */
    readonly parent?: string;
    /** Heliocentric Keplerian elements. Absent for the Sun and for satellites. */
    readonly orbit?: IOrbitalElements;
    /** Rotation axis + prime meridian (IAU WGCCRE) packaged as an {@link AxialTilt}. */
    readonly tilt?: AxialTilt;
}
