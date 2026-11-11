import { SolarSystemBodies } from "@spacexr/celestial-core/catalog";
import { CelestialTracker } from "@spacexr/celestial-core/observers";
import { GeodeticSystem } from "@spacexr/geodesy";
import { makePhysicalScene, type IPhysicalAtmosphereConfig } from "@spacexr/atmosphere";

/** Physical shape and gravity have one owner: the Celestial catalogue. */
export const EARTH = SolarSystemBodies.Earth!;
export const EARTH_SYSTEM = new GeodeticSystem(EARTH.ellipsoid);

/** Geometric ECEF Sun direction, from Celestial's approximate observer model. No refraction. */
export function earthSunDirection(date: Date): readonly [number,number,number] {
    // At latitude/longitude 0, local east=+Y, north=+Z, up=+X.
    const sun=CelestialTracker.GetSunPosition(date,0,0);
    const horizontal=Math.cos(sun.altitudeRadians);
    return [Math.sin(sun.altitudeRadians),-horizontal*Math.sin(sun.azimuthRadians),-horizontal*Math.cos(sun.azimuthRadians)];
}

/** Atmospheric composition defaults stay in atmosphere; shape and gravity come from Celestial. */
export function earthAtmosphere(date: Date, options: Omit<IPhysicalAtmosphereConfig,"ellipsoid"|"gravity"|"planet"> = {}) {
    return makePhysicalScene({...options,ellipsoid:EARTH.ellipsoid,gravity:EARTH.gravity.value},earthSunDirection(date)).model;
}
