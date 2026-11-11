import { Ellipsoid, GeodeticSystem } from "@spacexr/geodesy";
import { describe, expect, it } from "vitest";
import { WebMercatorTileMetrics, WebMercatorTileSurface, WebMercatorProjection, ReferenceSurface } from "../src";

describe("parameterized reference surfaces", () => {
    it("uses the caller radii for projection, metrics and geometry", () => {
        const system = new GeodeticSystem(Ellipsoid.sphere("fixture", 1000));
        const metrics = new WebMercatorTileMetrics({ minLOD: 0, maxLOD: 4, tileSize: 1 }, system);
        expect(metrics.groundResolution(0, 0)).toBeCloseTo(2 * Math.PI * 1000);
        expect(new WebMercatorTileSurface(system).point({ lod: 0, x: 0, y: 0 }, 0.5, 0.5).x).toBeCloseTo(1000);
        const projection = new WebMercatorProjection({ semiMajorAxis: 1000 });
        expect(projection.forward({ x: 0, y: 1, z: 0 }).x).toBeCloseTo(Math.PI * 500);
        expect(ReferenceSurface.sphere(1000).radius({ x: 1, y: 0, z: 0 })).toBe(1000);
    });
});
