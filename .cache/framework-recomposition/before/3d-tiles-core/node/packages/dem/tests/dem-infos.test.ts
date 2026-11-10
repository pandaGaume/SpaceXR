import { rasterRangeInArea, type IImageDecoder } from "@spacexr/raster";
import type { FetchFunction } from "@spacexr/tiles";
import { describe, expect, it } from "vitest";

import { DemInfos, computeGridNormals, createHeightGrid, createMapzenTerrariumSource, LocalDemDecoder, loadDemTile } from "../src";

function grid(width: number, values: number[]): DemInfos {
    return new DemInfos(createHeightGrid(width, values.length / width, new Float32Array(values)));
}

describe("DemInfos", () => {
    it("computes statistics over valid samples, including a maximum in the first sample", () => {
        const infos = grid(3, [50, 10, Number.NaN, 20, 30, 0]);
        expect(infos.highest).toEqual({ column: 0, row: 0, height: 50 });
        expect(infos.lowest).toEqual({ column: 2, row: 1, height: 0 });
        expect(infos.minimum).toBe(0);
        expect(infos.maximum).toBe(50);
        expect(infos.mean).toBe(22);
        expect(infos.delta).toBe(50);
        expect(infos.noDataCount).toBe(1);
    });

    it("reports undefined extremes when every sample is missing", () => {
        const infos = grid(2, [Number.NaN, Number.NaN]);
        expect(infos.lowest).toBeUndefined();
        expect(infos.mean).toBeNaN();
        expect(infos.delta).toBeNaN();
    });

    it("copies a view with its normals and recomputes the statistics", () => {
        const heights = [0, 1, 2, 3, 4, 5, 6, 7, 8];
        const normals = new Float32Array(heights.flatMap((value) => [value, 0, 1]));
        const infos = new DemInfos(createHeightGrid(3, 3, new Float32Array(heights)), normals);
        const view = infos.view(1, 1, 2, 2);
        expect([...view.data]).toEqual([4, 5, 7, 8]);
        expect([...view.normals!].filter((_, index) => index % 3 === 0)).toEqual([4, 5, 7, 8]);
        expect(view).toMatchObject({ minimum: 4, maximum: 8, mean: 6 });
        view.data[0] = 99;
        expect(infos.data[4]).toBe(4);
        expect(() => infos.view(2, 2, 2, 2)).toThrow(RangeError);
    });

    it("rejects normals that do not match the grid", () => {
        expect(() => new DemInfos(createHeightGrid(2, 1, new Float32Array(2)), new Float32Array(3))).toThrow(RangeError);
    });
});

describe("computeGridNormals", () => {
    const expectNormal = (normals: Float32Array, index: number, expected: [number, number, number]): void => {
        for (let axis = 0; axis < 3; axis++) expect(normals[index * 3 + axis]).toBeCloseTo(expected[axis]!, 6);
    };

    it("returns up on flat ground", () => {
        const normals = computeGridNormals(createHeightGrid(2, 2, new Float32Array(4)), 10);
        for (let index = 0; index < 4; index++) expectNormal(normals, index, [0, 0, 1]);
    });

    it("tilts away from slopes rising east and north, including at the edges", () => {
        const spacing = 10;
        // Height rises by one spacing per column eastward: a 45 degree slope.
        const east = computeGridNormals(createHeightGrid(3, 2, new Float32Array([0, 10, 20, 0, 10, 20])), spacing);
        for (let index = 0; index < 6; index++) expectNormal(east, index, [-Math.SQRT1_2, 0, Math.SQRT1_2]);
        // Rows grow southward, so heights decreasing with the row rise northward.
        const north = computeGridNormals(createHeightGrid(2, 3, new Float32Array([20, 20, 10, 10, 0, 0])), spacing);
        for (let index = 0; index < 6; index++) expectNormal(north, index, [0, -Math.SQRT1_2, Math.SQRT1_2]);
    });

    it("falls back to one-sided differences next to missing samples", () => {
        const normals = computeGridNormals(createHeightGrid(3, 1, new Float32Array([Number.NaN, 0, 10])), 10);
        expectNormal(normals, 1, [-Math.SQRT1_2, 0, Math.SQRT1_2]);
        expectNormal(normals, 0, [0, 0, 1]);
    });
});

describe("loadDemTile", () => {
    const decoder: IImageDecoder = {
        decode: () =>
            Promise.resolve({
                width: 2,
                height: 2,
                // Terrarium heights 0, 1, 2 and 3 m.
                channels: 4,
                data: new Uint8ClampedArray([128, 0, 0, 255, 128, 1, 0, 255, 128, 2, 0, 255, 128, 3, 0, 255]),
            }),
    };

    it("returns a tile with its DEM infos and normals", async () => {
        const fetch: FetchFunction = () => Promise.resolve(new Response("png", { status: 200 }));
        const tile = await loadDemTile(createMapzenTerrariumSource({ client: { fetch } }), { lod: 3, x: 2, y: 3 }, new LocalDemDecoder(decoder), { normals: true });
        expect(tile?.key).toBe("mapzen-terrarium:" + tile?.quadkey);
        expect(tile?.content).toMatchObject({ minimum: 0, maximum: 3, mean: 1.5 });
        expect(tile?.content?.normals).toHaveLength(12);
    });

    it("returns undefined for an absent tile", async () => {
        const fetch: FetchFunction = () => Promise.resolve(new Response(null, { status: 404 }));
        await expect(loadDemTile(createMapzenTerrariumSource({ client: { fetch } }), { lod: 3, x: 2, y: 3 }, new LocalDemDecoder(decoder))).resolves.toBeUndefined();
    });
});

describe("quadrant height ranges", () => {
    // 4 x 4 grid; the samples of column 1 and 2, and of row 1 and 2, influence both halves.
    const heights = [
        [10, 11, 12, 13],
        [20, 21, 22, 23],
        [30, 31, 32, 99],
        [-5, 41, 42, 43],
    ];
    const infos = new DemInfos(createHeightGrid(4, 4, new Float32Array(heights.flat())));

    it("computes the four child ranges with the tile range", () => {
        expect(infos.minimum).toBe(-5);
        expect(infos.maximum).toBe(99);
        expect(infos.quadrants).toEqual([
            { minimum: 10, maximum: 32 },
            { minimum: 11, maximum: 99 },
            { minimum: -5, maximum: 42 },
            { minimum: 21, maximum: 99 },
        ]);
    });

    it("matches rasterRangeInArea on the halves", () => {
        expect(rasterRangeInArea(infos, 0, 0, 0.5, 0.5)).toEqual(infos.quadrants[0]);
        expect(rasterRangeInArea(infos, 0.5, 0.5, 1, 1)).toEqual(infos.quadrants[3]);
        expect(rasterRangeInArea(infos, 0, 0, 1, 1)).toEqual({ minimum: -5, maximum: 99 });
        expect(() => rasterRangeInArea(infos, 0.6, 0, 0.4, 1)).toThrow(RangeError);
    });

    it("reports NaN bounds for quadrants without valid samples", () => {
        // Columns and rows 0 to 2 influence the north-west quadrant of a 4 x 4 grid.
        const N = Number.NaN;
        const sparse = new DemInfos(createHeightGrid(4, 4, new Float32Array([N, N, N, 1, N, N, N, 2, N, N, N, 3, 4, 5, 6, 7])));
        expect(sparse.quadrants[1]).toEqual({ minimum: 1, maximum: 3 });
        expect(sparse.quadrants[0]).toEqual({ minimum: Number.NaN, maximum: Number.NaN });
    });
});
