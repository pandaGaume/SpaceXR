import type { ITileAddress } from "@spacexr/tiles";
import { describe, expect, it, vi } from "vitest";

import { ChildHeightRanges, DemPyramid, createHeightGrid, createMapzenTerrariumSource, selectSurfaceLevels, webDemTileLoader, webMercatorSurfaceNormal } from "../src";

/** Plane `height = 1000 * x + 500 * y` over the whole pyramid, sampled at the pixel centres of 4 x 4 tiles. */
function planeTile(address: ITileAddress) {
    const count = 2 ** address.lod;
    const heights: number[] = [];
    for (let row = 0; row < 4; row++) {
        for (let column = 0; column < 4; column++) {
            const x = (address.x + (column + 0.5) / 4) / count;
            const y = (address.y + (row + 0.5) / 4) / count;
            heights.push(1000 * x + 500 * y);
        }
    }
    return Promise.resolve(createHeightGrid(4, 4, new Float32Array(heights)));
}

describe("DemPyramid", () => {
    it("loads tile heights with their range and records the child ranges", async () => {
        const childHeightRanges = new ChildHeightRanges();
        const pyramid = new DemPyramid({ registration: "area", load: planeTile, maxLOD: 2, childHeightRanges });
        const heights = await pyramid.tileHeights({ lod: 1, x: 0, y: 0 });

        expect(heights?.demAddress).toEqual({ lod: 1, x: 0, y: 0 });
        expect(heights?.sampler(1, 1)).toBeCloseTo(750, 3);
        // The north-west corner of the pyramid has no pixels beyond it: it takes the value of its only pixel.
        expect(heights?.range).toEqual({ minimum: 93.75, maximum: 750 });
        expect(heights?.quadrants[3].maximum).toBe(750);
        expect(childHeightRanges.size).toBe(4);
        expect(childHeightRanges.rangeFor({ lod: 2, x: 1, y: 1 })).toEqual([heights!.quadrants[3].minimum, 750]);
        expect(childHeightRanges.rangeFor({ lod: 2, x: 2, y: 2 })).toBeUndefined();
    });

    it("overzooms beyond maxLOD and samples the same surface", async () => {
        const pyramid = new DemPyramid({ registration: "area", load: planeTile, maxLOD: 1 });
        const heights = await pyramid.tileHeights({ lod: 3, x: 3, y: 1 });

        expect(pyramid.demLevel(3)).toBe(1);
        expect(heights?.demAddress).toEqual({ lod: 1, x: 0, y: 0 });
        // The plane at the north-west corner of tile 3/3/1.
        expect(heights?.sampler(0, 0)).toBeCloseTo(1000 * (3 / 8) + 500 * (1 / 8), 3);
    });

    it("generates DEM levels below the source with the chosen interpolation", async () => {
        const pyramid = new DemPyramid({ registration: "area", load: planeTile, maxLOD: 1, generation: { maxLOD: 3, interpolation: "cubic" } });
        const heights = await pyramid.tileHeights({ lod: 3, x: 3, y: 1 });

        expect(pyramid.demLevel(3)).toBe(3);
        expect(pyramid.demLevel(5)).toBe(3);
        expect(heights?.demAddress).toEqual({ lod: 3, x: 3, y: 1 });
        // A plane stays a plane through cubic generations.
        expect(heights?.sampler(0, 0)).toBeCloseTo(1000 * (3 / 8) + 500 * (1 / 8), 2);
        expect(pyramid.heightAt(3 / 8 + 1 / 32, 1 / 8, 3)).toBeCloseTo(1000 * (3 / 8 + 1 / 32) + 500 / 8, 2);
    });

    it("gives the same height and gradient from either side of a tile edge", async () => {
        const pyramid = new DemPyramid({ registration: "area", load: planeTile, maxLOD: 2, wrapX: true });
        expect(pyramid.heightAt(0.5, 0.25, 1)).toBeNaN();
        expect(pyramid.surfaceGradient(0.5, 0.25, [1], 4)).toBeUndefined();
        await Promise.all([pyramid.tileHeights({ lod: 1, x: 0, y: 0 }), pyramid.tileHeights({ lod: 1, x: 1, y: 0 })]);

        expect(pyramid.heightAt(0.5, 0.25, 1)).toBeCloseTo(625, 3);
        expect(pyramid.surfaceHeight(0.25, 0.25, [1, 2])).toBeCloseTo(375, 3);
        const [alongX, alongY] = pyramid.surfaceGradient(0.5, 0.25, [1], 4)!;
        expect(alongX).toBeCloseTo(1000, 1);
        expect(alongY).toBeCloseTo(500, 1);
    });

    it("selects the levels of a surface point by policy", () => {
        expect(selectSurfaceLevels([3, 4], "coarsest")).toEqual([3]);
        expect(selectSurfaceLevels([3, 4], "finest")).toEqual([4]);
        expect(selectSurfaceLevels([3, 4], "average")).toEqual([3, 4]);
        expect(selectSurfaceLevels([], "coarsest")).toEqual([]);
    });
});

describe("ChildHeightRanges", () => {
    it("skips quadrants without valid samples", () => {
        const ranges = new ChildHeightRanges();
        const empty = { minimum: Number.NaN, maximum: Number.NaN };
        ranges.recordChildren({ lod: 0, x: 0, y: 0 }, [{ minimum: 1, maximum: 2 }, empty, empty, empty]);

        expect(ranges.size).toBe(1);
        expect(ranges.rangeFor({ lod: 1, x: 0, y: 0 })).toEqual([1, 2]);
    });
});

describe("webMercatorSurfaceNormal", () => {
    it("returns up on flat ground and at the poles", () => {
        const up = { x: 1, y: 0, z: 0 };
        expect(webMercatorSurfaceNormal([0, 0], up)).toEqual(up);
        expect(webMercatorSurfaceNormal([1e6, 1e6], { x: 0, y: 0, z: 1 })).toEqual({ x: 0, y: 0, z: 1 });
    });

    it("tilts away from slopes rising east and south", () => {
        // On the equator at longitude 0, east is +y and north is +z.
        const circumference = 2 * Math.PI * 6378137;
        const normal = webMercatorSurfaceNormal([circumference, circumference], { x: 1, y: 0, z: 0 });
        // One metre per metre rising east and southward: the normal leans west and north.
        expect(normal.y).toBeCloseTo(-1 / Math.sqrt(3), 6);
        expect(normal.z).toBeCloseTo(1 / Math.sqrt(3), 6);
        expect(Math.hypot(normal.x, normal.y, normal.z)).toBeCloseTo(1, 12);
    });
});

describe("webDemTileLoader", () => {
    it("passes decoded heights directly to the pyramid and forwards cancellation", async () => {
        const source = createMapzenTerrariumSource();
        const bytes = new Uint8Array([1, 2, 3]);
        const fetchTile = vi.spyOn(source.source, "fetchTile").mockResolvedValue({ status: "ok", url: "memory://dem", bytes, contentType: undefined });
        const grid = createHeightGrid(2, 2, new Float32Array([1, 2, Number.NaN, 4]));
        const decodeDem = vi.fn(async () => grid);
        const address = { lod: 1, x: 0, y: 0 };
        const signal = new AbortController().signal;
        expect(await webDemTileLoader(source, { decodeDem })(address, signal)).toBe(grid);
        expect(fetchTile).toHaveBeenCalledWith(address, signal);
        expect(decodeDem).toHaveBeenCalledWith(bytes, source.encoding, { signal });
    });

    it("does not decode a tile reported absent", async () => {
        const source = createMapzenTerrariumSource();
        vi.spyOn(source.source, "fetchTile").mockResolvedValue({ status: "absent", url: "memory://dem", httpStatus: 404 });
        const decodeDem = vi.fn();
        expect(await webDemTileLoader(source, { decodeDem })({ lod: 1, x: 0, y: 0 })).toBeUndefined();
        expect(decodeDem).not.toHaveBeenCalled();
    });
});
