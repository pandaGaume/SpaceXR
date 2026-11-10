import type { ITileAddress } from "@spacexr/tiles";
import { describe, expect, it } from "vitest";

import { DemPyramid, createHeightGrid, createMapzenTerrariumSource } from "../src";

/** Small tiles: the registration does not depend on their size, and generated levels load many of them. */
const SIZE = 32;

/** Tiles whose pixels hold the position of their own centre, in pixels of a level: what a source in `area` publishes. */
function pixelRamp(axis: "x" | "y") {
    return (address: ITileAddress) =>
        Promise.resolve(
            createHeightGrid(
                SIZE,
                SIZE,
                Float32Array.from({ length: SIZE * SIZE }, (_, index) =>
                    axis === "x" ? address.x * SIZE + (index % SIZE) + 0.5 : address.y * SIZE + Math.floor(index / SIZE) + 0.5
                )
            )
        );
}

/** Tiles whose samples hold their own position on the edges of the tile: what a source in `point` publishes. */
function pointRamp(axis: "x" | "y") {
    return (address: ITileAddress) =>
        Promise.resolve(
            createHeightGrid(
                SIZE + 1,
                SIZE + 1,
                Float32Array.from({ length: (SIZE + 1) * (SIZE + 1) }, (_, index) =>
                    axis === "x" ? address.x * SIZE + (index % (SIZE + 1)) : address.y * SIZE + Math.floor(index / (SIZE + 1))
                )
            )
        );
}

const POSITIONS = [
    [10, 10],
    [12.25, 6.75],
    [25, 25],
    [SIZE, SIZE],
    [37.5, 5.25],
] as const;

/** Reads the ramp back at positions in pixels of a level: a surface in its place returns the position asked. */
async function gaps(east: DemPyramid, south: DemPyramid, lod: number): Promise<number[]> {
    const extent = SIZE * 2;
    const result: number[] = [];
    for (const [x, y] of POSITIONS) {
        const tile = { lod, x: Math.min(Math.floor((x / extent) * 2 ** lod), 2 ** lod - 1), y: Math.min(Math.floor((y / extent) * 2 ** lod), 2 ** lod - 1) };
        await Promise.all([east.rasters.load(tile), south.rasters.load(tile)]);
        result.push(east.heightAt(x / extent, y / extent, lod) - x, south.heightAt(x / extent, y / extent, lod) - y);
    }
    return result;
}

describe("registration of DEM sources", () => {
    it("reads tiles in area registration in their place", async () => {
        const east = new DemPyramid({ registration: "area", maxLOD: 1, load: pixelRamp("x") });
        const south = new DemPyramid({ registration: "area", maxLOD: 1, load: pixelRamp("y") });

        for (const gap of await gaps(east, south, 1)) expect(Math.abs(gap)).toBeLessThan(1e-3);
    });

    it("reads tiles in point registration in their place", async () => {
        const east = new DemPyramid({ registration: "point", maxLOD: 1, load: pointRamp("x") });
        const south = new DemPyramid({ registration: "point", maxLOD: 1, load: pointRamp("y") });

        for (const gap of await gaps(east, south, 1)) expect(Math.abs(gap)).toBeLessThan(1e-3);
    });

    it("moves the surface by half a pixel when a source declares the wrong registration", async () => {
        const size = SIZE + 1;
        // Samples of a point source read as pixels are centred half a pixel from where they were taken.
        const east = new DemPyramid({
            registration: "area",
            maxLOD: 0,
            load: () =>
                Promise.resolve(
                    createHeightGrid(
                        size,
                        size,
                        Float32Array.from({ length: size * size }, (_, index) => index % size)
                    )
                ),
        });
        await east.rasters.load({ lod: 0, x: 0, y: 0 });

        expect(east.heightAt(0.5, 0.5, 0)).toBeCloseTo(size / 2 - 0.5, 3);
        expect(east.heightAt(0.5, 0.5, 0) - SIZE / 2).not.toBeCloseTo(-0.5, 3);
    });

    it("keeps generated levels in their place, from the corners of the pixels of the source", async () => {
        for (const interpolation of ["bilinear", "cubic"] as const) {
            const east = new DemPyramid({ registration: "area", maxLOD: 1, generation: { maxLOD: 3, interpolation }, load: pixelRamp("x") });
            const south = new DemPyramid({ registration: "area", maxLOD: 1, generation: { maxLOD: 3, interpolation }, load: pixelRamp("y") });

            for (const gap of await gaps(east, south, 3)) expect(Math.abs(gap)).toBeLessThan(1e-3);
        }
    });

    it("declares Mapzen Terrarium in area registration", () => {
        expect(createMapzenTerrariumSource().source.registration).toBe("area");
    });
});
