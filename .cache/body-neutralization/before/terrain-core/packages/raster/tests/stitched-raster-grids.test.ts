import { describe, expect, it } from "vitest";

import { StitchedRasterGrids, createRasterGrid, rasterRangeInArea, sampleRasterBilinear, type IRasterGrid } from "../src";

/** 2 x 2 grid whose samples are `base + 0, 1, 10, 11`. */
function grid(base: number): IRasterGrid<Float32Array> {
    return createRasterGrid(2, 2, 1, new Float32Array([base, base + 1, base + 10, base + 11]));
}

function rows(stitched: IRasterGrid | undefined): number[][] {
    if (!stitched) throw new Error("Missing grid.");
    const length = stitched.width * stitched.channels;
    return Array.from({ length: stitched.height }, (_, row) => [...stitched.data.subarray(row * length, (row + 1) * length)]);
}

describe("StitchedRasterGrids of generated tiles", () => {
    it("repeats the tile edges until the neighbours arrive", () => {
        const grids = new StitchedRasterGrids({ registration: "area" });
        expect(grids.add({ lod: 2, x: 1, y: 1 }, grid(100), "generated").map(({ x, y }) => `${x}/${y}`)).toEqual(["1/1"]);

        expect(rows(grids.get({ lod: 2, x: 1, y: 1 }))).toEqual([
            [100, 101, 101],
            [110, 111, 111],
            [110, 111, 111],
        ]);
    });

    it("pulls the east, south and south-east edges whatever the arrival order", () => {
        const grids = new StitchedRasterGrids({ registration: "area" });
        grids.add({ lod: 2, x: 2, y: 1 }, grid(200), "generated"); // east
        grids.add({ lod: 2, x: 2, y: 2 }, grid(400), "generated"); // south-east
        grids.add({ lod: 2, x: 1, y: 1 }, grid(100), "generated");
        const changed = grids.add({ lod: 2, x: 1, y: 2 }, grid(300), "generated"); // south, completes its northern neighbour

        expect(changed.map(({ x, y }) => `${x}/${y}`)).toEqual(["1/2", "1/1"]);
        expect(rows(grids.get({ lod: 2, x: 1, y: 1 }))).toEqual([
            [100, 101, 200],
            [110, 111, 210],
            [300, 301, 400],
        ]);
    });

    it("lets neighbouring tiles sample identical values on their shared edge", () => {
        const grids = new StitchedRasterGrids({ registration: "area" });
        grids.add({ lod: 2, x: 1, y: 1 }, grid(100), "generated");
        grids.add({ lod: 2, x: 2, y: 1 }, grid(200), "generated");
        const west = grids.get({ lod: 2, x: 1, y: 1 })!;
        const east = grids.get({ lod: 2, x: 2, y: 1 })!;

        for (const v of [0, 0.25, 0.5]) {
            expect(sampleRasterBilinear(west, 1, v, 0, "point")).toBe(sampleRasterBilinear(east, 0, v, 0, "point"));
        }
        expect(rasterRangeInArea(west, 0.5, 0, 1, 0.5, "point")).toEqual({ minimum: 101, maximum: 210 });
    });

    it("stitches every channel of colour rasters and keeps their array type", () => {
        const pixel = (value: number) => [value, value + 1, value + 2, 255];
        const rgba = (base: number) => createRasterGrid(1, 1, 4, new Uint8ClampedArray(pixel(base)));
        const grids = new StitchedRasterGrids({ registration: "area" });
        grids.add({ lod: 1, x: 0, y: 0 }, rgba(10), "generated");
        grids.add({ lod: 1, x: 1, y: 0 }, rgba(20), "generated");
        grids.add({ lod: 1, x: 0, y: 1 }, rgba(30), "generated");
        grids.add({ lod: 1, x: 1, y: 1 }, rgba(40), "generated");

        const stitched = grids.get({ lod: 1, x: 0, y: 0 })!;
        expect(stitched.data).toBeInstanceOf(Uint8ClampedArray);
        expect(rows(stitched)).toEqual([
            [...pixel(10), ...pixel(20)],
            [...pixel(30), ...pixel(40)],
        ]);
    });

    it("builds each stitched grid with the factory", () => {
        const grids = new StitchedRasterGrids({
            registration: "area",
            create: (width, height, channels, data: Float32Array) => ({ ...createRasterGrid(width, height, channels, data), first: data[0]! }),
        });
        grids.add({ lod: 1, x: 1, y: 0 }, grid(200), "generated");
        grids.add({ lod: 1, x: 0, y: 0 }, grid(100), "generated");

        expect(grids.get({ lod: 1, x: 0, y: 0 })?.first).toBe(100);
        expect(grids.get({ lod: 1, x: 0, y: 0 })?.width).toBe(3);
    });

    it("wraps around the antimeridian on request", () => {
        const grids = new StitchedRasterGrids({ registration: "area", wrapX: true });
        grids.add({ lod: 1, x: 0, y: 0 }, grid(100), "generated");
        grids.add({ lod: 1, x: 1, y: 0 }, grid(200), "generated");

        expect(rows(grids.get({ lod: 1, x: 1, y: 0 }))[0]).toEqual([200, 201, 100]);
    });

    it("rejects neighbours of another size or channel count", () => {
        const grids = new StitchedRasterGrids({ registration: "area" });
        grids.add({ lod: 2, x: 2, y: 1 }, createRasterGrid(3, 3, 1, new Float32Array(9)), "generated");
        grids.add({ lod: 2, x: 1, y: 2 }, createRasterGrid(2, 2, 2, new Float32Array(8)), "generated");

        expect(() => grids.add({ lod: 2, x: 1, y: 1 }, grid(100), "generated")).toThrow(RangeError);
        expect(() => grids.add({ lod: 2, x: 1, y: 3 }, grid(100), "generated")).toThrow(RangeError);
    });
});

describe("StitchedRasterGrids of pixels in area registration", () => {
    /** Tile of 2 x 2 pixels, each holding the position of its own centre along the east, in pixels of the level. */
    const ramp = (x: number) => createRasterGrid(2, 2, 1, new Float32Array([2 * x + 0.5, 2 * x + 1.5, 2 * x + 0.5, 2 * x + 1.5]));

    it("moves samples to the corners of the pixels, as the mean of the four around each one", () => {
        const grids = new StitchedRasterGrids({ registration: "area" });
        for (let x = 0; x < 3; x++) for (let y = 0; y < 3; y++) grids.add({ lod: 3, x, y }, ramp(x));

        // A corner of column c of the centre tile lies at 2 + c along the ramp.
        expect(rows(grids.get({ lod: 3, x: 1, y: 1 }))).toEqual([
            [2, 3, 4],
            [2, 3, 4],
            [2, 3, 4],
        ]);
    });

    it("leaves out the pixels of absent tiles until they arrive, whatever the arrival order", () => {
        const addresses = [
            { lod: 2, x: 0, y: 0 },
            { lod: 2, x: 1, y: 0 },
            { lod: 2, x: 2, y: 0 },
            { lod: 2, x: 0, y: 1 },
            { lod: 2, x: 1, y: 1 },
            { lod: 2, x: 2, y: 1 },
            { lod: 2, x: 0, y: 2 },
            { lod: 2, x: 1, y: 2 },
            { lod: 2, x: 2, y: 2 },
        ];
        const pixels = ({ x, y }: { x: number; y: number }) => grid(x * 1000 + y * 100);
        const alone = new StitchedRasterGrids({ registration: "area" });
        alone.add({ lod: 2, x: 1, y: 1 }, grid(100));
        expect(rows(alone.get({ lod: 2, x: 1, y: 1 }))).toEqual([
            [100, 100.5, 101],
            [105, 105.5, 106],
            [110, 110.5, 111],
        ]);

        const forward = new StitchedRasterGrids({ registration: "area" });
        const backward = new StitchedRasterGrids({ registration: "area" });
        for (const address of addresses) forward.add(address, pixels(address));
        for (const address of [...addresses].reverse()) backward.add(address, pixels(address));
        for (const address of addresses) expect(rows(forward.get(address))).toEqual(rows(backward.get(address)));
    });

    it("gives neighbouring tiles identical samples on their shared edges and corners", () => {
        const grids = new StitchedRasterGrids({ registration: "area" });
        for (let x = 0; x < 2; x++) for (let y = 0; y < 2; y++) grids.add({ lod: 2, x, y }, grid(x * 1000 + y * 100));
        const [nw, ne, sw, se] = [grids.get({ lod: 2, x: 0, y: 0 })!, grids.get({ lod: 2, x: 1, y: 0 })!, grids.get({ lod: 2, x: 0, y: 1 })!, grids.get({ lod: 2, x: 1, y: 1 })!];

        for (const v of [0, 0.25, 0.5, 1]) expect(sampleRasterBilinear(nw, 1, v, 0, "point")).toBe(sampleRasterBilinear(ne, 0, v, 0, "point"));
        for (const u of [0, 0.25, 0.5, 1]) expect(sampleRasterBilinear(nw, u, 1, 0, "point")).toBe(sampleRasterBilinear(sw, u, 0, 0, "point"));
        expect(sampleRasterBilinear(nw, 1, 1, 0, "point")).toBe(sampleRasterBilinear(se, 0, 0, 0, "point"));
    });

    it("reports the tile and every neighbour it completes", () => {
        const grids = new StitchedRasterGrids({ registration: "area" });
        grids.add({ lod: 2, x: 1, y: 0 }, grid(0));
        grids.add({ lod: 2, x: 0, y: 1 }, grid(0));
        grids.add({ lod: 2, x: 2, y: 2 }, grid(0));

        expect(grids.add({ lod: 2, x: 1, y: 1 }, grid(0)).map(({ x, y }) => `${x}/${y}`)).toEqual(["1/1", "1/0", "0/1", "2/2"]);
    });

    it("leaves missing values out of the mean, and rounds the values of integer rasters", () => {
        const grids = new StitchedRasterGrids({ registration: "area" });
        grids.add({ lod: 0, x: 0, y: 0 }, createRasterGrid(2, 2, 1, new Float32Array([Number.NaN, 2, 4, 6])));
        expect(grids.get({ lod: 0, x: 0, y: 0 })!.data[4]).toBe(4);

        const colours = new StitchedRasterGrids({ registration: "area" });
        colours.add({ lod: 0, x: 0, y: 0 }, createRasterGrid(2, 2, 1, new Uint8Array([1, 2, 2, 2])));
        expect(colours.get({ lod: 0, x: 0, y: 0 })!.data[4]).toBe(2);
    });

    it("wraps a level of one column around itself on request", () => {
        const grids = new StitchedRasterGrids({ registration: "area", wrapX: true });
        grids.add({ lod: 0, x: 0, y: 0 }, createRasterGrid(2, 1, 1, new Float32Array([0, 10])));

        expect(rows(grids.get({ lod: 0, x: 0, y: 0 }))[0]).toEqual([5, 5, 5]);
    });

    it("rejects neighbours of another size or channel count", () => {
        const grids = new StitchedRasterGrids({ registration: "area" });
        grids.add({ lod: 2, x: 2, y: 1 }, createRasterGrid(3, 3, 1, new Float32Array(9)));

        expect(() => grids.add({ lod: 2, x: 1, y: 1 }, grid(100))).toThrow(RangeError);
    });
});
