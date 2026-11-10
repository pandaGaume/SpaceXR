import { describe, expect, it } from "vitest";

import { WebMercatorTileMetrics, ancestorTileAddress, childTileAddresses, isValidTileAddress, parentTileAddress, quadkeyToTileAddress, tileAddressToQuadkey, toTmsY } from "../src";

describe("tile addressing", () => {
    it("encodes and decodes Bing Maps quadkeys", () => {
        // Example from the Bing Maps tile system documentation.
        expect(tileAddressToQuadkey({ lod: 3, x: 3, y: 5 })).toBe("213");
        expect(quadkeyToTileAddress("213")).toEqual({ lod: 3, x: 3, y: 5 });
        expect(tileAddressToQuadkey({ lod: 0, x: 0, y: 0 })).toBe("");
        for (const address of [
            { lod: 1, x: 1, y: 0 },
            { lod: 15, x: 9634, y: 11218 },
            { lod: 23, x: 4194303, y: 1 },
        ]) {
            expect(quadkeyToTileAddress(tileAddressToQuadkey(address))).toEqual(address);
        }
        expect(() => quadkeyToTileAddress("124")).toThrow(RangeError);
    });

    it("converts XYZ and TMS rows symmetrically", () => {
        expect(toTmsY(0, 3)).toBe(7);
        expect(toTmsY(toTmsY(5, 3), 3)).toBe(5);
    });

    it("navigates parents, ancestors and children", () => {
        const address = { lod: 5, x: 13, y: 22 };
        expect(parentTileAddress(address)).toEqual({ lod: 4, x: 6, y: 11 });
        expect(parentTileAddress({ lod: 0, x: 0, y: 0 })).toBeUndefined();
        expect(ancestorTileAddress(address, 3)).toEqual({ lod: 2, x: 1, y: 2 });
        expect(ancestorTileAddress(address, 99)).toEqual({ lod: 0, x: 0, y: 0 });
        const children = childTileAddresses(address);
        expect(children).toEqual([
            { lod: 6, x: 26, y: 44 },
            { lod: 6, x: 27, y: 44 },
            { lod: 6, x: 26, y: 45 },
            { lod: 6, x: 27, y: 45 },
        ]);
        expect(children.map((child) => parentTileAddress(child))).toEqual([address, address, address, address]);
    });

    it("validates addresses against their level", () => {
        expect(isValidTileAddress({ lod: 2, x: 3, y: 3 })).toBe(true);
        expect(isValidTileAddress({ lod: 2, x: 4, y: 0 })).toBe(false);
        expect(isValidTileAddress({ lod: -1, x: 0, y: 0 })).toBe(false);
        expect(isValidTileAddress({ lod: 2, x: 1.5, y: 0 })).toBe(false);
    });
});

describe("WebMercatorTileMetrics", () => {
    it("keeps the east and south map edges inside the pyramid", () => {
        const metrics = new WebMercatorTileMetrics({ minLOD: 0, maxLOD: 15 });
        expect(metrics.getLatLonToTileXY(0, 180, 3)).toEqual({ x: 7, y: 4 });
        expect(metrics.getLatLonToTileXY(-90, -180, 3)).toEqual({ x: 0, y: 7 });
        expect(metrics.getLatLonToTileXY(85.0511287798066, -180, 3)).toEqual({ x: 0, y: 0 });
    });

    it("round trips tile corners", () => {
        const metrics = new WebMercatorTileMetrics({ minLOD: 0, maxLOD: 20 });
        const corner = metrics.getTileXYToLatLon(9634, 11218, 15);
        expect(metrics.getLatLonToTileXY(corner.latitude - 1e-9, corner.longitude + 1e-9, 15)).toEqual({ x: 9634, y: 11218 });
    });
});
