import { Ellipsoid, GeodeticSystem } from "@spacexr/geodesy";

/** Offline Earth demonstration fixture, matching the celestial-core Earth ellipsoid. */
export const SAMPLE_SYSTEM = new GeodeticSystem(Ellipsoid.fromAxes("Earth demo fixture", 6378137, 6356752.314245179));
