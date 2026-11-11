import { CUBE_FACE_EDGES, CubeFace, ResidentTiles, TileNeighbor, TilePyramid, cubeTileNeighbor, flatTileTopology, tileAddressKey, type ITileAddress } from "@spacexr/tiles";
import { describe, expect, it } from "vitest";

import { RasterPyramid, StitchedRasterGrids, createRasterGrid, generatePointChildRaster, type IRasterGrid } from "../src";

/** A grid of `size x size` samples, each value computed from its column and row. */
function grid(size: number, value: (column: number, row: number) => number): IRasterGrid<Float32Array> {
    const data = new Float32Array(size * size);
    for (let row = 0; row < size; row++) for (let column = 0; column < size; column++) data[row * size + column] = value(column, row);
    return createRasterGrid(size, size, 1, data);
}

describe("declared registration", () => {
    const load = async (): Promise<undefined> => undefined;

    it.each([undefined, "pixel", "AREA"])("rejects the registration %s", (registration) => {
        expect(() => new StitchedRasterGrids({ registration: registration as never })).toThrow(TypeError);
        expect(() => new RasterPyramid({ registration: registration as never, maxLOD: 2, load })).toThrow(TypeError);
    });

    it.each([
        [true, "point"],
        [false, "area"],
    ] as const)("accepts the deprecated prestitched: %s beside registration: %s", (prestitched, registration) => {
        expect(() => new StitchedRasterGrids({ registration, prestitched })).not.toThrow();
        expect(() => new RasterPyramid({ registration, prestitched, maxLOD: 2, load })).not.toThrow();
    });

    it.each([
        [true, "area"],
        [false, "point"],
    ] as const)("rejects the deprecated prestitched: %s against registration: %s", (prestitched, registration) => {
        expect(() => new StitchedRasterGrids({ registration, prestitched })).toThrow(/prestitched is deprecated/);
        expect(() => new RasterPyramid({ registration, prestitched, maxLOD: 2, load })).toThrow(/prestitched is deprecated/);
    });

    it("does not take the deprecated prestitched in place of registration", () => {
        expect(() => new RasterPyramid({ prestitched: true, maxLOD: 2, load } as never)).toThrow(/registration: "point"/);
    });

    it("loads with the registration, whatever the deprecated prestitched says beside it", async () => {
        const requested: string[] = [];
        const pyramid = new RasterPyramid({
            registration: "point",
            prestitched: true,
            maxLOD: 2,
            load: async (address) => {
                requested.push(tileAddressKey(address));
                return grid(3, () => 1);
            },
        });
        await pyramid.load({ lod: 2, x: 1, y: 1 });
        expect(requested).toEqual([tileAddressKey({ lod: 2, x: 1, y: 1 })]);
    });
});

describe("prestitched rasters", () => {
    it("are used as they are, without their neighbours", () => {
        const stitched = new StitchedRasterGrids({ registration: "point" });
        const east = grid(3, () => 7);
        const address = { face: 3, lod: 2, x: 1, y: 1 };
        const own = grid(3, (column, row) => column + 10 * row);
        stitched.add({ face: 3, lod: 2, x: 2, y: 1 }, east);
        expect(stitched.add(address, own)).toEqual([address]);
        expect(stitched.get(address)).toMatchObject({ width: 3, height: 3, data: own.data });
        expect(() =>
            stitched.add(
                address,
                grid(1, () => 0)
            )
        ).toThrow(RangeError);
    });

    it("load without neighbours and keep faces apart", async () => {
        const requested: string[] = [];
        const pyramid = new RasterPyramid({
            registration: "point",
            maxLOD: 2,
            load: async (address) => {
                requested.push(tileAddressKey(address));
                return grid(3, () => address.face ?? 0);
            },
        });
        const south = await pyramid.load({ face: CubeFace.South, lod: 2, x: 1, y: 1 });
        const north = await pyramid.load({ face: CubeFace.North, lod: 2, x: 1, y: 1 });
        expect(requested).toEqual(["5/2/1/1", "4/2/1/1"]);
        expect(south!.sample(0.5, 0.5)).toBe(5);
        expect(north!.sample(0.5, 0.5)).toBe(4);
        expect(pyramid.sampleAt(0.375, 0.375, 2, 0, CubeFace.South)).toBe(5);
        expect(pyramid.sampleAt(0.375, 0.375, 2, 0, CubeFace.PositiveY)).toBeNaN();
    });

    it("generate children from their parent, with the edges of the parent", async () => {
        const value = (column: number, row: number): number => column * column + 3 * row;
        const parent = grid(5, value);
        const child = generatePointChildRaster(parent, 1, 0);
        // Samples on the lattice of the parent keep its values: sample i of the east child is parent sample (4 + i) / 2.
        expect(child.data[0]).toBe(value(2, 0));
        expect(child.data[2]).toBe(value(3, 0));
        expect(child.data[4]).toBe(value(4, 0));
        // Between two samples of the parent, the value interpolates the edge alone.
        expect(child.data[1]).toBe((value(2, 0) + value(3, 0)) / 2);
        // Interior samples interpolate bilinearly.
        expect(child.data[5 + 1]).toBeCloseTo((value(2, 0) + value(3, 0) + value(2, 1) + value(3, 1)) / 4, 5);

        const loads: string[] = [];
        const pyramid = new RasterPyramid({
            registration: "point",
            maxLOD: 1,
            generation: { maxLOD: 3 },
            load: async (address) => {
                loads.push(tileAddressKey(address));
                return address.lod === 1 ? parent : undefined;
            },
        });
        const generated = await pyramid.load({ face: CubeFace.PositiveY, lod: 3, x: 2, y: 3 });
        expect(generated!.grid.width).toBe(5);
        expect(loads).toEqual(["1/1/0/0"]);
    });

    it("keep the edges of neighbouring children identical, across a turned face edge", () => {
        // Face 1 north edge meets face 4 east edge, reversed: the two parents hold the same shared samples.
        const junction = CUBE_FACE_EDGES[CubeFace.PositiveY]![TileNeighbor.N];
        expect(junction).toMatchObject({ face: CubeFace.North, edge: TileNeighbor.E, reversed: true });
        const shared = [2, 9, 4, 7, 1];
        const own = grid(5, (column, row) => (row === 0 ? shared[column]! : 100 + column + row));
        const other = grid(5, (column, row) => (column === 4 ? shared[4 - row]! : 200 + column + row));
        const address = { face: CubeFace.PositiveY, lod: 0, x: 0, y: 0 };
        expect(cubeTileNeighbor(address, TileNeighbor.N)?.address).toEqual({ face: CubeFace.North, lod: 0, x: 0, y: 0 });

        // The west child of face 1 touches the south half of the east edge of face 4.
        const child = generatePointChildRaster(own, 0, 0);
        const otherChild = generatePointChildRaster(other, 1, 1);
        for (let i = 0; i < 5; i++) expect(child.data[i]).toBe(otherChild.data[(4 - i) * 5 + 4]);
    });
});

describe("tiles of different faces", () => {
    it("stay apart in pyramids and residency", async () => {
        const pyramid = new TilePyramid<string>({ maxLOD: 3, load: async (address) => tileAddressKey(address) });
        expect((await pyramid.load({ face: 1, lod: 1, x: 0, y: 0 }))?.content).toBe("1/1/0/0");
        expect((await pyramid.load({ face: 2, lod: 1, x: 0, y: 0 }))?.content).toBe("2/1/0/0");
        expect((await pyramid.load({ lod: 1, x: 0, y: 0 }))?.content).toBe("1/0/0");
        expect((await pyramid.load({ face: 0, lod: 1, x: 0, y: 0 }))?.content).toBe("1/0/0");

        const resident = new ResidentTiles<number>();
        const address: ITileAddress = { face: 5, lod: 3, x: 1, y: 2 };
        resident.set({ face: 5, lod: 1, x: 0, y: 0 }, 5);
        resident.set({ face: 4, lod: 2, x: 0, y: 1 }, 4);
        expect(resident.cover(address)).toMatchObject({ value: 5, size: 0.25 });
        expect(resident.cover({ ...address, face: 3 })).toBeUndefined();
        expect(resident.depthWithin({ face: 4, lod: 1, x: 0, y: 0 })).toBe(1);
        expect(resident.depthWithin({ face: 5, lod: 0, x: 0, y: 0 })).toBe(1);
        expect(resident.depthWithin({ face: 3, lod: 0, x: 0, y: 0 })).toBeUndefined();
    });

    it("use the area of a flat topology across the antimeridian", () => {
        const topology = flatTileTopology({ wrapX: true });
        // The west edge of column 0 touches the east edge of the last column.
        const area = topology.areaIn({ lod: 3, x: 0, y: 2 }, { lod: 3, x: 7, y: 2 });
        expect(area).toEqual({ west: 1, north: 0, size: 1, turns: 0 });
        expect(topology.areaIn({ lod: 3, x: 7, y: 2 }, { lod: 3, x: 0, y: 2 })).toEqual({ west: -1, north: 0, size: 1, turns: 0 });
        expect(flatTileTopology().neighbor({ lod: 1, x: 0, y: 0 }, TileNeighbor.W)).toBeUndefined();
        expect(topology.neighbor({ lod: 1, x: 0, y: 0 }, TileNeighbor.W)).toEqual({ address: { lod: 1, x: 1, y: 0 }, turns: 0 });
    });
});
