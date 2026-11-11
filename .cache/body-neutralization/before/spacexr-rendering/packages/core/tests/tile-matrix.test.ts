import { Vector3 } from "@babylonjs/core/Maths/math.vector.js";
import type { IEcefSpatialState } from "@spacexr/3d-tiles-runtime";
import { Ellipsoid } from "@spacexr/geodesy";
import { describe, expect, it } from "vitest";

import { createBabylonTileMatrix } from "../src";

describe("createBabylonTileMatrix", () => {
    it("converts glTF Y-up content to 3D Tiles Z-up before entering the ECEF world", () => {
        const spatial: IEcefSpatialState = {
            worldTransform: new Float64Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, Ellipsoid.WGS84.semiMajorAxis, 0, 0, 1]),
            geometricError: 0,
        };
        const matrix = createBabylonTileMatrix(spatial);

        const origin = Vector3.TransformCoordinates(Vector3.Zero(), matrix);
        const localPoint = Vector3.TransformCoordinates(new Vector3(10, 20, 30), matrix);

        expect(origin.x).toBeCloseTo(Ellipsoid.WGS84.semiMajorAxis, 8);
        expect(origin.y).toBeCloseTo(0, 8);
        expect(origin.z).toBeCloseTo(0, 8);
        expect(localPoint.x).toBeCloseTo(Ellipsoid.WGS84.semiMajorAxis + 10, 8);
        expect(localPoint.y).toBeCloseTo(-30, 8);
        expect(localPoint.z).toBeCloseTo(20, 8);
    });
});

describe("createBabylonTileMatrix with an offset", () => {
    it("moves the content, without turning it", () => {
        const spatial: IEcefSpatialState = {
            worldTransform: new Float64Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 100, 0, 0, 1]),
            geometricError: 0,
        };
        const plain = createBabylonTileMatrix(spatial);
        const moved = createBabylonTileMatrix(spatial, { x: 1, y: 2, z: 3 });

        const origin = Vector3.TransformCoordinates(Vector3.Zero(), moved);
        expect([origin.x, origin.y, origin.z]).toEqual([101, 2, 3]);
        expect(Array.from(moved.m).slice(0, 12)).toEqual(Array.from(plain.m).slice(0, 12));
    });
});
