import { GeodeticSystem } from "@spacexr/geodesy";
import { describe, expect, it } from "vitest";

import { gridShape, tileCenterEcef, tileCenterLongitude, webMercatorLatitude } from "../src/terrain/gpu/grid-shapes";

describe("gridShape", () => {
    it("places every tile of a row by rotating the shape about the polar axis by the centre longitude", () => {
        const system = GeodeticSystem.WGS84;
        const cells = 4;
        const tile = { lod: 12, x: 2130, y: 1450 };
        const shape = gridShape(tile.lod, tile.y, cells);
        const center = tileCenterEcef(tile);
        const longitude = tileCenterLongitude(tile);
        const [cos, sin] = [Math.cos(longitude), Math.sin(longitude)];
        const count = 2 ** tile.lod;

        for (const [i, j] of [
            [0, 0],
            [4, 0],
            [2, 2],
            [0, 4],
            [4, 4],
        ] as const) {
            const offset = (j * (cells + 1) + i) * 4;
            const [x, y, z] = [shape[offset]!, shape[offset + 1]!, shape[offset + 2]!];
            const placed = { x: cos * x - sin * y + center.x, y: sin * x + cos * y + center.y, z: z + center.z };
            const latitude = webMercatorLatitude((tile.y + j / cells) / count);
            const expected = system.geodeticRadiansToEcef(latitude, ((tile.x + i / cells) / count) * 2 * Math.PI - Math.PI, 0);

            // Within a centimetre for a tile about 6 km wide: float shapes keep only distances within the tile.
            expect(Math.hypot(placed.x - expected.x, placed.y - expected.y, placed.z - expected.z)).toBeLessThan(0.01);
            expect(shape[offset + 3]).toBeCloseTo(latitude, 6);
        }
    });

    it("centres the shape on the tile", () => {
        const shape = gridShape(5, 9, 2);
        const middle = (1 * 3 + 1) * 4;
        expect(Math.hypot(shape[middle]!, shape[middle + 1]!, shape[middle + 2]!)).toBeLessThan(1e-3);
    });
});
