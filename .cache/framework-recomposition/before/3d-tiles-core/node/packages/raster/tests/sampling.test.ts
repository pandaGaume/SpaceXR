import { describe, expect, it } from "vitest";

import { createRasterGrid, rasterRangeInArea, sampleCoordinate, sampleRasterBilinear, sampleSpan } from "../src";

const single = (width: number, values: number[]) => createRasterGrid(width, values.length / width, 1, new Float32Array(values));

describe("createRasterGrid", () => {
    it("checks the dimensions against the values", () => {
        expect(createRasterGrid(2, 1, 4, new Uint8Array(8)).channels).toBe(4);
        expect(() => createRasterGrid(2, 1, 4, new Uint8Array(7))).toThrow(RangeError);
        expect(() => createRasterGrid(0, 1, 1, new Uint8Array(0))).toThrow(RangeError);
        expect(() => createRasterGrid(1, 1, 0, new Uint8Array(0))).toThrow(RangeError);
    });
});

describe("sampleRasterBilinear", () => {
    // 2 x 2 grid: pixel centres at u, v = 0.25 and 0.75.
    const grid = single(2, [0, 10, 20, 30]);

    it("returns pixel values at pixel centres and clamps to the edge samples", () => {
        expect(sampleRasterBilinear(grid, 0.25, 0.25)).toBe(0);
        expect(sampleRasterBilinear(grid, 0.75, 0.75)).toBe(30);
        expect(sampleRasterBilinear(grid, 0, 0)).toBe(0);
        expect(sampleRasterBilinear(grid, 1, 1)).toBe(30);
    });

    it("interpolates between pixel centres", () => {
        expect(sampleRasterBilinear(grid, 0.5, 0.25)).toBe(5);
        expect(sampleRasterBilinear(grid, 0.5, 0.5)).toBe(15);
    });

    it("places the samples on the tile edges with point registration", () => {
        expect(sampleCoordinate(1, 2, "point")).toBe(1);
        expect(sampleRasterBilinear(grid, 0, 0, 0, "point")).toBe(0);
        expect(sampleRasterBilinear(grid, 1, 0, 0, "point")).toBe(10);
        expect(sampleRasterBilinear(grid, 0.5, 0.5, 0, "point")).toBe(15);
    });

    it("ignores missing neighbours and returns NaN only when all are missing", () => {
        const gap = single(2, [Number.NaN, 10, 20, 30]);
        expect(sampleRasterBilinear(gap, 0.5, 0.5)).toBe(20);
        // Exactly on the missing pixel: falls back to the nearest valid corner.
        expect(sampleRasterBilinear(gap, 0.25, 0.25)).toBe(10);
        expect(sampleRasterBilinear(single(1, [Number.NaN]), 0.5, 0.5)).toBeNaN();
    });

    it("handles single-sample grids", () => {
        expect(sampleRasterBilinear(single(1, [7]), 0.9, 0.1)).toBe(7);
    });

    it("samples each channel of an interleaved raster", () => {
        const rgba = createRasterGrid(2, 1, 4, new Uint8ClampedArray([0, 100, 200, 255, 100, 200, 0, 255]));
        expect([0, 1, 2, 3].map((channel) => sampleRasterBilinear(rgba, 0.5, 0.5, channel))).toEqual([50, 150, 100, 255]);
    });
});

describe("rasterRangeInArea", () => {
    // 4 x 4 grid; the samples of column 1 and 2, and of row 1 and 2, influence both halves.
    const grid = single(4, [10, 11, 12, 13, 20, 21, 22, 23, 30, 31, 32, 99, -5, 41, 42, 43]);

    it("covers every sample a bilinear sample in the area interpolates", () => {
        expect(sampleSpan(0, 0.5, 4)).toEqual({ first: 0, last: 2 });
        expect(sampleSpan(0.5, 1, 4)).toEqual({ first: 1, last: 3 });
        expect(rasterRangeInArea(grid, 0, 0, 0.5, 0.5)).toEqual({ minimum: 10, maximum: 32 });
        expect(rasterRangeInArea(grid, 0, 0, 1, 1)).toEqual({ minimum: -5, maximum: 99 });
        expect(rasterRangeInArea(grid, 0, 0, 0.5, 0.5, "point")).toEqual({ minimum: 10, maximum: 32 });
        expect(() => rasterRangeInArea(grid, 0.6, 0, 0.4, 1)).toThrow(RangeError);
    });

    it("bounds every bilinear sample taken inside an area, in both registrations", () => {
        const random = (() => {
            let seed = 7;
            return () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
        })();
        const values = single(
            8,
            Array.from({ length: 64 }, () => Math.round(random() * 4000))
        );
        for (const registration of ["area", "point"] as const) {
            for (let trial = 0; trial < 200; trial++) {
                const [west, east] = [random(), random()].sort((a, b) => a - b) as [number, number];
                const [north, south] = [random(), random()].sort((a, b) => a - b) as [number, number];
                const range = rasterRangeInArea(values, west, north, east, south, registration);
                for (let sample = 0; sample < 20; sample++) {
                    const value = sampleRasterBilinear(values, west + (east - west) * random(), north + (south - north) * random(), 0, registration);
                    expect(value).toBeGreaterThanOrEqual(range.minimum - 1e-3);
                    expect(value).toBeLessThanOrEqual(range.maximum + 1e-3);
                }
            }
        }
    });

    it("reads the requested channel and reports NaN bounds without valid samples", () => {
        const pairs = createRasterGrid(2, 1, 2, new Float32Array([1, Number.NaN, 5, Number.NaN]));
        expect(rasterRangeInArea(pairs, 0, 0, 1, 1, "area", 0)).toEqual({ minimum: 1, maximum: 5 });
        expect(rasterRangeInArea(pairs, 0, 0, 1, 1, "area", 1)).toEqual({ minimum: Number.NaN, maximum: Number.NaN });
    });
});
