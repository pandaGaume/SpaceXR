import { Ellipsoid } from "../../../../geodesy";
import { BoxType, RegionType, SphereType, CreateTileSphereFromBox } from "../boundingVolume";

/**
 * Region bounding-volume conversion (3D Tiles `boundingVolume.region`).
 *
 * A region is [west, south, east, north, minHeight, maxHeight] in EPSG:4979
 * (lon/lat in radians, heights in meters above the ellipsoid). Regions are
 * expressed directly in ECEF and are NOT subject to the tile `transform`
 * chain (3D Tiles specification).
 *
 * The conversion samples the region surface at both height bounds, fits an
 * oriented bounding box aligned to the ENU frame at the region center, and
 * inflates it by the chord sagitta of the sampling step so the continuous
 * (curved) region is guaranteed to be enclosed.
 */

/** Max angular sampling step (radians). 10 degrees keeps the sample count bounded for planet-wide regions. */
const MAX_SAMPLING_STEP = (10 * Math.PI) / 180;

/**
 * Geodetic (radians, meters) to ECEF on the given ellipsoid.
 */
export function GeodeticRadToEcef(latRad: number, lonRad: number, height: number, ellipsoid: Ellipsoid, out: { x: number; y: number; z: number }): void {
    const sinLat = Math.sin(latRad);
    const cosLat = Math.cos(latRad);
    const sinLon = Math.sin(lonRad);
    const cosLon = Math.cos(lonRad);
    const n = ellipsoid.semiMajorAxis / Math.sqrt(1 - ellipsoid.sqrEccentricity * sinLat * sinLat);
    const tmp = (height + n) * cosLat;
    out.x = tmp * cosLon;
    out.y = tmp * sinLon;
    out.z = (height + ellipsoid.oneMinusSqrEccentricity * n) * sinLat;
}

/**
 * Converts a 3D Tiles region to an ECEF oriented bounding box (BoxType:
 * [center xyz, x half-axis xyz, y half-axis xyz, z half-axis xyz]).
 *
 * The box axes are the ENU (east / north / up) directions at the region
 * center, which yields tight boxes for the small regions typical of deep
 * tiles and safely conservative boxes for continent / planet scale regions.
 */
export function RegionToBoxECEF(region: RegionType, ellipsoid: Ellipsoid = Ellipsoid.WGS84): BoxType {
    const west = region[0];
    const south = region[1];
    let east = region[2];
    const north = region[3];
    const hMin = region[4];
    const hMax = region[5];

    // Antimeridian crossing: the spec allows west > east; unwrap east.
    if (east < west) east += 2 * Math.PI;

    const lonCenter = (west + east) / 2;
    const latCenter = (south + north) / 2;

    // ENU basis at the region center (geodetic up).
    const sinLat = Math.sin(latCenter);
    const cosLat = Math.cos(latCenter);
    const sinLon = Math.sin(lonCenter);
    const cosLon = Math.cos(lonCenter);
    const ex = -sinLon,
        ey = cosLon,
        ez = 0; // east
    const nx = -sinLat * cosLon,
        ny = -sinLat * sinLon,
        nz = cosLat; // north
    const ux = cosLat * cosLon,
        uy = cosLat * sinLon,
        uz = sinLat; // up

    const origin = { x: 0, y: 0, z: 0 };
    GeodeticRadToEcef(latCenter, lonCenter, (hMin + hMax) / 2, ellipsoid, origin);

    // Sample the region at both heights on a grid bounded by MAX_SAMPLING_STEP.
    const lonSpan = east - west;
    const latSpan = north - south;
    const lonSteps = Math.max(1, Math.ceil(lonSpan / MAX_SAMPLING_STEP));
    const latSteps = Math.max(1, Math.ceil(latSpan / MAX_SAMPLING_STEP));

    let minE = Number.POSITIVE_INFINITY,
        maxE = Number.NEGATIVE_INFINITY;
    let minN = Number.POSITIVE_INFINITY,
        maxN = Number.NEGATIVE_INFINITY;
    let minU = Number.POSITIVE_INFINITY,
        maxU = Number.NEGATIVE_INFINITY;

    const p = { x: 0, y: 0, z: 0 };
    for (let i = 0; i <= latSteps; i++) {
        const lat = south + (latSpan * i) / latSteps;
        for (let j = 0; j <= lonSteps; j++) {
            const lon = west + (lonSpan * j) / lonSteps;
            for (let h = 0; h < 2; h++) {
                GeodeticRadToEcef(lat, lon, h === 0 ? hMin : hMax, ellipsoid, p);
                const dx = p.x - origin.x;
                const dy = p.y - origin.y;
                const dz = p.z - origin.z;
                const e = dx * ex + dy * ey + dz * ez;
                const n2 = dx * nx + dy * ny + dz * nz;
                const u = dx * ux + dy * uy + dz * uz;
                if (e < minE) minE = e;
                if (e > maxE) maxE = e;
                if (n2 < minN) minN = n2;
                if (n2 > maxN) maxN = n2;
                if (u < minU) minU = u;
                if (u > maxU) maxU = u;
            }
        }
    }

    // The sampled hull under-estimates the curved surface between samples by
    // at most the chord sagitta of a grid cell's DIAGONAL arc (the bulge is
    // maximal at the cell centre). Unscaled delta-lon is conservative.
    const stepDiagonal = Math.hypot(lonSpan / lonSteps, latSpan / latSteps);
    // Curvature radius, not the semi-major axis: on an ellipsoid the normal
    // curvature radius peaks at the poles (a / sqrt(1 - e^2)), so using `a`
    // would under-inflate the bound at high latitude.
    const maxCurvatureRadius = ellipsoid.semiMajorAxis / Math.sqrt(ellipsoid.oneMinusSqrEccentricity);
    const outerRadius = maxCurvatureRadius + Math.max(hMax, 0);
    const sagitta = outerRadius * (1 - Math.cos(stepDiagonal / 2));
    minE -= sagitta;
    maxE += sagitta;
    minN -= sagitta;
    maxN += sagitta;
    minU -= sagitta;
    maxU += sagitta;

    // Recentre and build half axes along the ENU directions.
    const cE = (minE + maxE) / 2;
    const cN = (minN + maxN) / 2;
    const cU = (minU + maxU) / 2;
    const hE = (maxE - minE) / 2;
    const hN = (maxN - minN) / 2;
    const hU = (maxU - minU) / 2;

    return [
        origin.x + cE * ex + cN * nx + cU * ux,
        origin.y + cE * ey + cN * ny + cU * uy,
        origin.z + cE * ez + cN * nz + cU * uz,
        hE * ex,
        hE * ey,
        hE * ez,
        hN * nx,
        hN * ny,
        hN * nz,
        hU * ux,
        hU * uy,
        hU * uz,
    ];
}

/**
 * Converts a 3D Tiles region to an enclosing ECEF sphere.
 */
export function RegionToSphereECEF(region: RegionType, ellipsoid: Ellipsoid = Ellipsoid.WGS84): SphereType {
    return CreateTileSphereFromBox(RegionToBoxECEF(region, ellipsoid));
}
