import { Ellipsoid, GeodeticSystem } from "@spacexr/geodesy";
import { describe, expect, it } from "vitest";
import { EcefSpatialMetric, ellipsoidalHeightRange, defaultHorizontalDatumResolver } from "../src";

describe("application-owned physical parameters", () => {
    it("places the same angular region on the supplied surface", () => {
        const make = (radius: number) => new EcefSpatialMetric({ geodeticSystem: new GeodeticSystem(Ellipsoid.sphere("fixture", radius)), horizonCulling: false }).derive({ tile: { boundingVolume: { region: [-0.01, -0.01, 0.01, 0.01, 0, 0] }, geometricError: 1 } });
        const small = make(1000).boundingSphere!;
        const large = make(2000).boundingSphere!;
        expect(large.center.x).toBeCloseTo(2 * small.center.x);
        expect(large.radius).toBeCloseTo(2 * small.radius);
    });
    it("does not select a datum or a geoid envelope", () => {
        expect(defaultHorizontalDatumResolver({ zone: 1, hemisphere: "north" } as never)).toBeUndefined();
        const vertical = { reference: "GEOID", direction: "UP", minimum: 10, maximum: 20 } as const;
        expect(() => ellipsoidalHeightRange(vertical, {})).toThrow(/explicit/);
        expect(ellipsoidalHeightRange(vertical, { geoidUndulationMargin: 3 })).toEqual([7, 23]);
    });
});
