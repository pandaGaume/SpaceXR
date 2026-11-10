import type { ITileAddress } from "@spacexr/tiles";
import { describe, expect, it } from "vitest";

import { RasterPyramid, createRasterGrid } from "../src";

/** 2 x 2 tiles whose values encode their column and row: `x * 100 + y * 10` plus `0, 1, 2, 3`. */
function load(address: ITileAddress) {
    const base = address.x * 100 + address.y * 10;
    return Promise.resolve(createRasterGrid(2, 2, 1, new Float32Array([base, base + 1, base + 2, base + 3])));
}

describe("RasterPyramid", () => {
    it("loads a tile with its neighbours and moves its samples to the corners of its pixels", async () => {
        const loads: string[] = [];
        const pyramid = new RasterPyramid({
            registration: "area",
            load: (address) => {
                loads.push(`${address.x}/${address.y}`);
                return load(address);
            },
            maxLOD: 1,
        });
        const region = await pyramid.load({ lod: 1, x: 0, y: 0 });

        expect(loads).toEqual(["0/0", "1/0", "0/1", "1/1"]);
        expect([...region!.grid.data]).toEqual([0, 0.5, 50.5, 1, 1.5, 51.5, 6, 6.5, 56.5]);
        expect(region!.sample(1, 1)).toBe(56.5);
        expect(region!.range(0.5, 0, 1, 1)).toEqual({ minimum: 0.5, maximum: 56.5 });
    });

    it("samples deeper tiles from the sub-area of their ancestor", async () => {
        const pyramid = new RasterPyramid({ registration: "area", load, maxLOD: 1 });
        const region = await pyramid.load({ lod: 2, x: 1, y: 0 });

        expect(region).toMatchObject({ ancestor: { lod: 1, x: 0, y: 0 }, west: 0.5, north: 0, size: 0.5 });
        expect(region!.sample(0, 0)).toBe(0.5);
        expect(region!.sample(1, 1)).toBe(region!.grid.data[5]);
    });

    it("samples points of the pyramid identically on both sides of a tile edge", async () => {
        const pyramid = new RasterPyramid({ registration: "area", load, maxLOD: 1 });
        expect(pyramid.sampleAt(0.5, 0.25, 1)).toBeNaN();
        await Promise.all([pyramid.load({ lod: 1, x: 0, y: 0 }), pyramid.load({ lod: 1, x: 1, y: 0 })]);

        const edge = pyramid.sampleAt(0.5, 0.25, 1);
        expect(edge).toBe(51.5);
        expect(pyramid.sampleAt(0.5, 0.25, 3)).toBe(edge);
        expect(pyramid.sampleAt(-0.25, 0.25, 1)).toBeNaN();
    });

    it("wraps the antimeridian on request", async () => {
        const pyramid = new RasterPyramid({ registration: "area", load, maxLOD: 1, wrapX: true });
        await pyramid.load({ lod: 1, x: 1, y: 0 });

        expect(pyramid.stitchedGrid({ lod: 1, x: 1, y: 0 })?.data[2]).toBe(50.5);
        expect(pyramid.sampleAt(-0.25, 0, 1)).toBe(pyramid.sampleAt(0.75, 0, 1));
    });

    it("reports the stitched grids each arrival changes", async () => {
        const changes: string[][] = [];
        const pyramid = new RasterPyramid({ registration: "area", load, maxLOD: 1, onStitched: (changed) => changes.push(changed.map(({ x, y }) => `${x}/${y}`)) });
        await pyramid.load({ lod: 1, x: 0, y: 0 });

        expect(changes).toContainEqual(["0/0"]);
        // The east neighbour completes the corners on the east edge of the tile.
        expect(changes.some((changed) => changed[0] === "1/0" && changed.includes("0/0"))).toBe(true);
    });

    it("reports stitched grids to listeners added after creation, until they are removed", async () => {
        const pyramid = new RasterPyramid({ registration: "area", load, maxLOD: 1 });
        const changes: string[] = [];
        const stop = pyramid.observeStitched((changed) => changes.push(...changed.map(({ x, y }) => `${x}/${y}`)));
        await pyramid.load({ lod: 1, x: 0, y: 0 });
        expect(changes).toContain("0/0");

        stop();
        changes.length = 0;
        await pyramid.load({ lod: 1, x: 0, y: 1 });
        expect(changes).toEqual([]);
    });

    it("returns undefined where the pyramid has no raster", async () => {
        const pyramid = new RasterPyramid({ registration: "area", load: () => Promise.resolve(undefined), maxLOD: 1 });
        expect(await pyramid.load({ lod: 0, x: 0, y: 0 })).toBeUndefined();
    });
});
