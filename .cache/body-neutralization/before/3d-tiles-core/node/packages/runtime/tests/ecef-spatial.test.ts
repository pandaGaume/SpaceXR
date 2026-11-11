import type { ITile } from "@spacexr/3d-tiles-core";
import { Ellipsoid, GeodeticSystem } from "@spacexr/geodesy";
import { beforeEach, describe, expect, it } from "vitest";

import { EcefSpatialMetric } from "../src";

describe("EcefSpatialMetric", () => {
    describe("horizon from the heights of a tile", () => {
        const radius = 1738100;
        const geodeticSystem = new GeodeticSystem(Ellipsoid.sphere("Moon", radius));
        const camera = { position: { x: radius + 50, y: 0, z: 0 }, viewportHeight: 1080 };
        let heights = new EcefSpatialMetric({ geodeticSystem, horizon: "tile-heights" });
        beforeEach(() => {
            heights = new EcefSpatialMetric({ geodeticSystem, horizon: "tile-heights" });
        });
        const plane = new EcefSpatialMetric({ geodeticSystem });
        /** A small tile at an angle from the camera, its centre at a height over the reference surface. */
        const tile = (angle: number, height: number, tileRadius = 10): ITile => ({
            boundingVolume: { sphere: [(radius + height) * Math.cos(angle), (radius + height) * Math.sin(angle), 0, tileRadius] },
            geometricError: 1,
        });
        const visible = (metric: EcefSpatialMetric, source: ITile, heightRange?: readonly [number, number]): boolean =>
            metric.isVisible(metric.derive({ tile: source, ...(heightRange ? { heightRange } : {}) }), camera);

        it("keeps a crater floor below the reference surface, which the plane culls", () => {
            const floor = tile(0.01, -4000);
            expect(visible(plane, floor)).toBe(false);
            expect(visible(heights, floor, [-4010, -3990])).toBe(true);
        });

        it("adds the horizon of the highest point of the tile", () => {
            // The horizons of the camera and of a summit at 5 km add up to 0.0834 rad; the plane stops at 0.0762 rad.
            const summit = tile(0.08, 5000);
            expect(visible(plane, summit)).toBe(false);
            expect(visible(heights, summit, [4990, 5010])).toBe(true);
            expect(visible(heights, tile(0.09, 5000), [4990, 5010])).toBe(false);
        });

        it("keeps a far rim seen over a basin deeper than the rim, once the basin is measured", () => {
            const rim = tile(0.1, 1000);
            // Over the reference surface alone, the rim lies beyond the horizon.
            expect(visible(heights, rim, [990, 1010])).toBe(false);
            // A sight line passes over the floor of the basin: only the sphere below it is solid.
            heights.derive({ tile: tile(0.05, -4000), heightRange: [-4010, -3990] });
            expect(visible(heights, rim, [990, 1010])).toBe(true);
            expect(visible(heights, tile(0.3, 1000), [990, 1010])).toBe(false);
        });

        it("culls a tile low on the far side of the horizon", () => {
            expect(visible(heights, tile(0.3, 0), [-10, 10])).toBe(false);
            expect(visible(heights, tile(Math.PI, -4000), [-4010, -3990])).toBe(false);
        });

        it("culls from the bounding sphere alone when the heights are unknown", () => {
            expect(visible(heights, tile(0.01, -4000))).toBe(true);
            expect(visible(heights, tile(Math.PI, 0))).toBe(false);
            // A sphere enclosing the centre of the body hides nothing.
            expect(visible(heights, tile(Math.PI, 0, 2 * radius))).toBe(true);
        });

        it("never culls from a camera below the sphere", () => {
            const below = { position: { x: radius - 5000, y: 0, z: 0 }, viewportHeight: 1080 };
            const source = heights.derive({ tile: tile(0.3, -4000), heightRange: [-4010, -3990] });
            expect(heights.isVisible(source, below)).toBe(true);
        });

        it("keeps the plane by default", () => {
            expect(plane.derive({ tile: tile(0.01, 0), heightRange: [-1, 1] }).heightRange).toEqual([-1, 1]);
            expect(visible(plane, tile(0.01, -4000), [-4010, -3990])).toBe(false);
        });
    });

    it("derives transformed bounds and transform-scaled geometric error", () => {
        const metric = new EcefSpatialMetric({ horizonCulling: false });
        const tile: ITile = {
            boundingVolume: { sphere: [1, 2, 3, 4] },
            geometricError: 5,
            transform: [2, 0, 0, 0, 0, 2, 0, 0, 0, 0, 2, 0, 10, 20, 30, 1],
        };

        const spatial = metric.derive({ tile });

        expect(spatial.boundingSphere).toEqual({ center: { x: 12, y: 24, z: 36 }, radius: 8 });
        expect(spatial.boundingBox).toEqual({ min: { x: 4, y: 16, z: 28 }, max: { x: 20, y: 32, z: 44 } });
        expect(spatial.geometricError).toBe(10);
    });

    it("computes screen-space error and applies clip bounds", () => {
        const metric = new EcefSpatialMetric({ horizonCulling: false });
        const tile: ITile = { boundingVolume: { sphere: [0, 0, 0, 1] }, geometricError: 2 };
        const spatial = metric.derive({ tile });
        const camera = {
            position: { x: 11, y: 0, z: 0 },
            viewportHeight: 1000,
            tanHalfVerticalFov: 1,
            clipBounds: { min: { x: -2, y: -2, z: -2 }, max: { x: 2, y: 2, z: 2 } },
        };

        expect(metric.isVisible(spatial, camera)).toBe(true);
        expect(metric.screenSpaceError({ camera, spatial, tile, depth: 0 })).toBe(100);
        expect(
            metric.isVisible(spatial, {
                ...camera,
                clipBounds: { min: { x: 20, y: 20, z: 20 }, max: { x: 30, y: 30, z: 30 } },
            }),
        ).toBe(false);
    });

    it("derives region bounds with the injected geodetic system", () => {
        const mars = Ellipsoid.fromAxes("Mars", 3_396_190, 3_376_200);
        const system = new GeodeticSystem(mars);
        const metric = new EcefSpatialMetric({ geodeticSystem: system, horizonCulling: false });
        const tile: ITile = {
            boundingVolume: { region: [0, 0, 0, 0, 0, 0] },
            geometricError: 1,
        };

        const spatial = metric.derive({ tile });

        expect(metric.geodeticSystem).toBe(system);
        expect(spatial.boundingSphere).toEqual({
            center: { x: mars.semiMajorAxis, y: 0, z: 0 },
            radius: 0,
        });
    });
});
