import { createUtmBoundingVolume, getUtmBoundingVolume, type ITile, type IUtmBoundingVolume } from "@spacexr/3d-tiles-core";
import { Ellipsoid, GeodeticSystem, UtmProjection } from "@spacexr/geodesy";
import { describe, expect, it } from "vitest";

import {
    EcefSpatialMetric,
    GEOID_UNDULATION_MARGIN,
    UNKNOWN_GROUND_HEIGHT_RANGE,
    ellipsoidalHeightRange,
    subdivideImplicitBoundingVolume,
} from "../src";

const collar = { easting: 438705.189, northing: 5830304.72, elevation: 254.085 };

const extent: IUtmBoundingVolume = {
    epsg: 26918,
    minEasting: collar.easting - 195,
    minNorthing: collar.northing - 195,
    maxEasting: collar.easting + 195,
    maxNorthing: collar.northing + 195,
    vertical: { reference: "GEOID", direction: "UP", minimum: collar.elevation - 195, maximum: collar.elevation, epsg: 6647 },
};

function collarEcef(): { x: number; y: number; z: number } {
    const geodetic = new UtmProjection(18, "N", Ellipsoid.GRS80).projectedToGeodeticRadians(
        collar.easting,
        collar.northing,
        collar.elevation,
    );
    return GeodeticSystem.WGS84.geodeticRadiansToEcef(geodetic.latitude, geodetic.longitude, geodetic.height);
}

function distance(left: { x: number; y: number; z: number }, right: { x: number; y: number; z: number }): number {
    return Math.hypot(left.x - right.x, left.y - right.y, left.z - right.z);
}

describe("SPACEXR_bounding_volume_utm spatial support", () => {
    it("places a UTM extent in ECEF around the drill hole collar", () => {
        const metric = new EcefSpatialMetric();
        const spatial = metric.derive({ tile: { boundingVolume: createUtmBoundingVolume(extent), geometricError: 10 } });

        const sphere = spatial.boundingSphere!;
        expect(distance(sphere.center, collarEcef())).toBeLessThan(sphere.radius);
        // Half diagonal of 390 m x 390 m x (195 m + two geoid margins), widened by the 4 m NAD83 datum accuracy.
        expect(sphere.radius).toBeLessThan(Math.hypot(195, 195, (195 + 2 * GEOID_UNDULATION_MARGIN) / 2) + 4 + 1);
        expect(sphere.radius).toBeGreaterThan(275);
        expect(spatial.geometricError).toBe(10);
    });

    it("prefers the UTM extent over a standard fallback volume and ignores the tile transform", () => {
        const metric = new EcefSpatialMetric();
        const tile: ITile = {
            boundingVolume: { box: [0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1], ...createUtmBoundingVolume(extent) },
            geometricError: 1,
            transform: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 1000, 2000, 3000, 1],
        };
        const spatial = metric.derive({ tile });
        expect(distance(spatial.boundingSphere!.center, collarEcef())).toBeLessThan(spatial.boundingSphere!.radius);
    });

    it("culls the extent behind the horizon and keeps it visible from above", () => {
        const metric = new EcefSpatialMetric();
        const spatial = metric.derive({ tile: { boundingVolume: createUtmBoundingVolume(extent), geometricError: 1 } });
        const center = spatial.boundingSphere!.center;
        const above = { x: center.x * 1.001, y: center.y * 1.001, z: center.z * 1.001 };
        const antipode = { x: -center.x * 1.001, y: -center.y * 1.001, z: -center.z * 1.001 };

        expect(metric.isVisible(spatial, { position: above, viewportHeight: 1080 })).toBe(true);
        expect(metric.isVisible(spatial, { position: antipode, viewportHeight: 1080 })).toBe(false);
    });

    it("leaves bounds empty when the UTM zone cannot be resolved", () => {
        const metric = new EcefSpatialMetric();
        const spatial = metric.derive({ tile: { boundingVolume: createUtmBoundingVolume({ ...extent, epsg: 26718 }), geometricError: 1 } });
        expect(spatial.boundingSphere).toBeUndefined();
        expect(spatial.utmPlacement).toEqual({ status: "unresolved-projection", horizontalMargin: 0, verticalMargin: 0 });
    });

    it("reports the datum transformation, geoid handling and margins it applied", () => {
        const spatial = new EcefSpatialMetric().derive({ tile: { boundingVolume: createUtmBoundingVolume(extent), geometricError: 1 } });
        expect(spatial.utmPlacement).toEqual({
            status: "placed",
            projection: { zone: 18, hemisphere: "N", datum: "NAD83", epsg: 26918 },
            datumTransformation: { name: "EPSG:1188 NAD83 to WGS 84 (1), null transformation", accuracy: 4 },
            horizontalMargin: 4,
            verticalOrigin: "geoid",
            geoid: "margin",
            verticalMargin: GEOID_UNDULATION_MARGIN,
            heightRange: [collar.elevation - 195 - GEOID_UNDULATION_MARGIN, collar.elevation + GEOID_UNDULATION_MARGIN],
        });
    });

    it("widens the bounds by the datum transformation accuracy", () => {
        const metric = new EcefSpatialMetric();
        const nad83 = metric.derive({ tile: { boundingVolume: createUtmBoundingVolume(extent), geometricError: 1 } });
        const wgs84 = metric.derive({ tile: { boundingVolume: createUtmBoundingVolume({ ...extent, epsg: 32618 }), geometricError: 1 } });
        expect(wgs84.utmPlacement?.datumTransformation).toEqual({ name: "identity", accuracy: 0 });
        expect(nad83.boundingSphere!.radius - wgs84.boundingSphere!.radius).toBeCloseTo(4, 2);
    });

    it("does not place an extent whose datum is unknown, and falls back to a standard volume", () => {
        const zoneOnly: IUtmBoundingVolume = { ...extent, zone: 18, hemisphere: "N" };
        delete zoneOnly.epsg;
        const metric = new EcefSpatialMetric({ horizonCulling: false });

        const unplaced = metric.derive({ tile: { boundingVolume: createUtmBoundingVolume(zoneOnly), geometricError: 1 } });
        expect(unplaced.utmPlacement).toMatchObject({ status: "unresolved-datum", projection: { zone: 18, hemisphere: "N" } });
        expect(unplaced.boundingSphere).toBeUndefined();

        const fallback = metric.derive({
            tile: { boundingVolume: { sphere: [1, 2, 3, 4], ...createUtmBoundingVolume(zoneOnly) }, geometricError: 1 },
        });
        expect(fallback.utmPlacement?.status).toBe("unresolved-datum");
        expect(fallback.boundingSphere).toEqual({ center: { x: 1, y: 2, z: 3 }, radius: 4 });
    });

    it("applies an injected datum transformation", () => {
        const zoneOnly: IUtmBoundingVolume = { ...extent, zone: 18, hemisphere: "N" };
        delete zoneOnly.epsg;
        const metric = new EcefSpatialMetric({
            utm: {
                datumResolver: () => ({
                    name: "application NAD27 to WGS 84",
                    accuracy: 10,
                    transform: (geodetic) => void (geodetic.longitude += 1e-5),
                }),
            },
        });
        const spatial = metric.derive({ tile: { boundingVolume: createUtmBoundingVolume(zoneOnly), geometricError: 1 } });
        expect(spatial.utmPlacement).toMatchObject({
            status: "placed",
            datumTransformation: { name: "application NAD27 to WGS 84", accuracy: 10 },
            horizontalMargin: 10,
        });
        expect(distance(spatial.boundingSphere!.center, collarEcef())).toBeGreaterThan(0.5);
    });

    it("uses an injected geoid model instead of the geoid margin", () => {
        const undulation = -30;
        const spatial = new EcefSpatialMetric({ utm: { geoidUndulation: () => undulation } }).derive({
            tile: { boundingVolume: createUtmBoundingVolume(extent), geometricError: 1 },
        });
        expect(spatial.utmPlacement).toMatchObject({
            geoid: "model",
            verticalMargin: 0,
            heightRange: [collar.elevation - 195, collar.elevation],
        });
        // 390 m x 390 m x 195 m, widened by the 4 m datum accuracy.
        expect(spatial.boundingSphere!.radius).toBeLessThan(Math.hypot(195, 195, 97.5) + 4 + 1);
    });

    it("derives conservative ellipsoidal height ranges", () => {
        expect(ellipsoidalHeightRange({ reference: "ELLIPSOID", direction: "DOWN", minimum: 0, maximum: 195 })).toEqual([-195, -0]);
        expect(ellipsoidalHeightRange({ reference: "GEOID", direction: "UP", minimum: 59, maximum: 254 })).toEqual([
            59 - GEOID_UNDULATION_MARGIN,
            254 + GEOID_UNDULATION_MARGIN,
        ]);
        expect(ellipsoidalHeightRange({ reference: "GROUND", direction: "DOWN", minimum: 0, maximum: 195, groundElevation: 254 })).toEqual([
            254 - 195 - GEOID_UNDULATION_MARGIN,
            254 + GEOID_UNDULATION_MARGIN,
        ]);
        expect(ellipsoidalHeightRange({ reference: "GROUND", direction: "DOWN", minimum: 0, maximum: 195 })).toEqual([
            UNKNOWN_GROUND_HEIGHT_RANGE[0] - 195,
            UNKNOWN_GROUND_HEIGHT_RANGE[1],
        ]);
    });

    it("subdivides UTM extents for implicit tiling", () => {
        const root = createUtmBoundingVolume({
            ...extent,
            vertical: { reference: "GROUND", direction: "DOWN", minimum: 0, maximum: 200, groundElevation: 254 },
        });

        const quadrant = getUtmBoundingVolume(subdivideImplicitBoundingVolume(root, "QUADTREE", { level: 1, x: 1, y: 0 }))!;
        expect(quadrant.minEasting).toBeCloseTo(collar.easting, 6);
        expect(quadrant.maxEasting).toBeCloseTo(collar.easting + 195, 6);
        expect(quadrant.minNorthing).toBeCloseTo(collar.northing - 195, 6);
        expect(quadrant.maxNorthing).toBeCloseTo(collar.northing, 6);
        expect(quadrant.vertical).toEqual(getUtmBoundingVolume(root)!.vertical);

        const deepest = getUtmBoundingVolume(subdivideImplicitBoundingVolume(root, "OCTREE", { level: 1, x: 0, y: 0, z: 0 }))!;
        expect(deepest.vertical).toMatchObject({ minimum: 100, maximum: 200 });
        const shallowest = getUtmBoundingVolume(subdivideImplicitBoundingVolume(root, "OCTREE", { level: 1, x: 0, y: 0, z: 1 }))!;
        expect(shallowest.vertical).toMatchObject({ minimum: 0, maximum: 100 });
    });
});
