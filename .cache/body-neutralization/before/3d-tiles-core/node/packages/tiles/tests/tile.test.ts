import { describe, expect, it } from "vitest";

import { Tile, WebMercatorTileMetrics } from "../src";

const metrics = new WebMercatorTileMetrics({ minLOD: 0, maxLOD: 15 });

describe("Tile", () => {
    it("derives its quadkey, key and bounds from the metrics", () => {
        const tile = new Tile({ lod: 1, x: 0, y: 0 }, metrics, "content", "imagery");
        expect(tile.quadkey).toBe("0");
        expect(tile.key).toBe("imagery:0");
        expect(tile.geoBounds.west).toBeCloseTo(-180, 9);
        expect(tile.geoBounds.east).toBeCloseTo(0, 9);
        expect(tile.geoBounds.south).toBeCloseTo(0, 9);
        expect(tile.geoBounds.north).toBeCloseTo(85.0511287798066, 9);
        expect(tile.pixelBounds).toEqual({ x: 0, y: 0, width: 256, height: 256 });
        expect(tile.content).toBe("content");
    });

    it("rejects addresses outside their level", () => {
        expect(() => new Tile({ lod: 1, x: 2, y: 0 }, metrics)).toThrow(RangeError);
    });
});
