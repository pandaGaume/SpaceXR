import { TileNeighbor, type ITileAddress } from "@spacexr/tiles";
import { describe, expect, it } from "vitest";

import { RasterPyramid, createRasterGrid, generateChildRaster, interpolateLattice, type IRasterGrid, type LatticeSampler, type RasterInterpolation } from "../src";

const INTERPOLATIONS: readonly RasterInterpolation[] = ["nearest", "linear", "bilinear", "cubic"];
const SMOOTH: readonly RasterInterpolation[] = ["linear", "bilinear", "cubic"];

describe("interpolateLattice", () => {
    it("reproduces constant values with every interpolation", () => {
        for (const interpolation of INTERPOLATIONS) expect(interpolateLattice(() => 7, 3.3, 8.7, interpolation)).toBeCloseTo(7, 12);
    });

    it("reproduces linear slopes with every interpolation but nearest", () => {
        const ramp: LatticeSampler = (x, y) => 3 * x - 2 * y + 1;
        for (const interpolation of SMOOTH) expect(interpolateLattice(ramp, 4.25, 6.6, interpolation)).toBeCloseTo(3 * 4.25 - 2 * 6.6 + 1, 10);
        expect(interpolateLattice(ramp, 4.25, 6.6, "nearest")).toBe(ramp(4, 7));
    });

    it("passes through the samples with every interpolation", () => {
        const bump: LatticeSampler = (x, y) => (x === 5 && y === 5 ? 10 : 0);
        for (const interpolation of INTERPOLATIONS) expect(interpolateLattice(bump, 5, 5, interpolation)).toBe(10);
    });

    it("splits each cell from its north-west to its south-east corner in linear interpolation", () => {
        // Only the north-east corner is raised: it affects the triangle above the diagonal only.
        const corner: LatticeSampler = (x, y) => (x === 1 && y === 0 ? 1 : 0);
        expect(interpolateLattice(corner, 0.75, 0.25, "linear")).toBeCloseTo(0.5, 12);
        expect(interpolateLattice(corner, 0.25, 0.75, "linear")).toBe(0);
    });

    it("leaves missing samples out", () => {
        const holes: LatticeSampler = (x) => (x === 1 ? Number.NaN : 4);
        for (const interpolation of SMOOTH) expect(interpolateLattice(holes, 0.5, 0.5, interpolation)).toBeCloseTo(4, 12);
        expect(interpolateLattice(() => Number.NaN, 0.5, 0.5, "bilinear")).toBeNaN();
    });
});

/** Tiles of `size x size` samples cut from a global lattice: tile `x` holds samples `x * size` to `x * size + size - 1`. */
function latticeTile(field: LatticeSampler, address: ITileAddress, size: number): IRasterGrid<Float32Array> {
    const data = new Float32Array(size * size);
    for (let j = 0; j < size; j++) for (let i = 0; i < size; i++) data[j * size + i] = field(address.x * size + i, address.y * size + j);
    return createRasterGrid(size, size, 1, data);
}

function neighborhood(field: LatticeSampler, parent: ITileAddress, size: number): (IRasterGrid<Float32Array> | undefined)[] {
    const tiles: (IRasterGrid<Float32Array> | undefined)[] = [];
    for (let row = -1; row <= 1; row++)
        for (let column = -1; column <= 1; column++) tiles.push(latticeTile(field, { lod: parent.lod, x: parent.x + column, y: parent.y + row }, size));
    return tiles;
}

describe("generateChildRaster", () => {
    const size = 8;
    const field: LatticeSampler = (x, y) => Math.sin(x * 0.7) * 40 + Math.cos(y * 0.45) * 25 + x * y * 0.1;

    it("interpolates the lattice of the parent level, so children of neighbouring parents agree", () => {
        for (const interpolation of INTERPOLATIONS) {
            for (const parentX of [3, 4]) {
                const parent = { lod: 4, x: parentX, y: 5 };
                for (const column of [0, 1]) {
                    const child = generateChildRaster(neighborhood(field, parent, size), column, 1, interpolation);
                    for (const [i, j] of [
                        [0, 0],
                        [size - 1, 3],
                        [3, size - 1],
                    ] as const) {
                        const x = (((parentX * 2 + column) * size + i) / 2) as number;
                        const y = (((parent.y * 2 + 1) * size + j) / 2) as number;
                        expect(child.data[j * size + i]).toBeCloseTo(interpolateLattice(field, x, y, interpolation), 3);
                    }
                }
            }
        }
    });

    it("repeats the parent edges where neighbours are missing", () => {
        const tiles = neighborhood(() => 5, { lod: 2, x: 1, y: 0 }, size);
        tiles[TileNeighbor.N] = tiles[TileNeighbor.NE] = tiles[TileNeighbor.NW] = undefined;
        const child = generateChildRaster(tiles, 0, 0, "cubic");
        expect([...child.data].every((value) => Math.abs(value - 5) < 1e-6)).toBe(true);
    });

    it("matches scalar cubic interpolation exactly over every child sample, including NaN stencils and odd sizes", () => {
        for (const size of [8, 9]) {
            for (const parentSamples of ["pixels", "lattice"] as const) {
                for (const holes of [false, true]) {
                    const stored: LatticeSampler = (x, y) =>
                        holes && (x % 7 === 0 || y % 11 === 0) ? Number.NaN : Math.fround(Math.sin(x * 0.37) * 4817 + Math.cos(y * 0.29) * 933);
                    const sample: LatticeSampler =
                        parentSamples === "lattice"
                            ? stored
                            : (x, y) => {
                                  let sum = 0;
                                  let count = 0;
                                  for (const value of [stored(x - 1, y - 1), stored(x, y - 1), stored(x - 1, y), stored(x, y)]) {
                                      if (Number.isNaN(value)) continue;
                                      sum += value;
                                      count++;
                                  }
                                  return count === 0 ? Number.NaN : sum / count;
                              };
                    const parent = { lod: 4, x: 3, y: 5 };
                    const tiles = neighborhood(stored, parent, size);
                    for (const column of [0, 1]) {
                        for (const row of [0, 1]) {
                            const child = generateChildRaster(tiles, column, row, "cubic", parentSamples);
                            const expected = new Float32Array(size * size);
                            for (let j = 0; j < size; j++) {
                                for (let i = 0; i < size; i++) {
                                    const x = parent.x * size + (column * size + i) / 2;
                                    const y = parent.y * size + (row * size + j) / 2;
                                    expected[j * size + i] = interpolateLattice(sample, x, y, "cubic");
                                }
                            }
                            expect(child.data).toEqual(expected);
                        }
                    }
                }
            }
        }
    });

    it("preserves double precision and clamped border stencils when cubic neighbours are absent", () => {
        const width = 7;
        const height = 5;
        const data = Float64Array.from({ length: width * height }, (_, i) => Math.sin(i * 0.73) * 12345678.90123);
        const parent = createRasterGrid(width, height, 1, data);
        const tiles = [undefined, undefined, undefined, undefined, parent];
        const sample: LatticeSampler = (x, y) => data[Math.max(0, Math.min(height - 1, y)) * width + Math.max(0, Math.min(width - 1, x))]!;
        for (const column of [0, 1]) {
            for (const row of [0, 1]) {
                const child = generateChildRaster(tiles, column, row, "cubic");
                const expected = new Float64Array(data.length);
                for (let j = 0; j < height; j++) {
                    for (let i = 0; i < width; i++) expected[j * width + i] = interpolateLattice(sample, (column * width + i) / 2, (row * height + j) / 2, "cubic");
                }
                expect(child.data).toEqual(expected);
            }
        }
    });

    it("keeps the channels and array type of the parent, and rejects inconsistent neighbourhoods", () => {
        const rgba = createRasterGrid(2, 2, 4, new Uint8ClampedArray(16).fill(200));
        const child = generateChildRaster([undefined, undefined, undefined, undefined, rgba, undefined, undefined, undefined, undefined], 1, 1, "bilinear");
        expect(child.data).toBeInstanceOf(Uint8ClampedArray);
        expect(child.channels).toBe(4);
        expect(() => generateChildRaster([rgba], 0, 0, "bilinear")).toThrow(RangeError);
        expect(() => generateChildRaster([createRasterGrid(1, 1, 4, new Uint8ClampedArray(4)), undefined, undefined, undefined, rgba], 0, 0, "bilinear")).toThrow(RangeError);
    });
});

describe("RasterPyramid generation", () => {
    it("generates the levels below the source, generation by generation", async () => {
        const loads: number[] = [];
        const size = 4;
        const field: LatticeSampler = (x, y) => 2 * x + y;
        const pyramid = new RasterPyramid({
            registration: "area",
            load: (address) => {
                loads.push(address.lod);
                // Pixels, centred half a pixel from the lattice of their level.
                return Promise.resolve(latticeTile((x, y) => field(x + 0.5, y + 0.5), address, size));
            },
            maxLOD: 2,
            generation: { maxLOD: 4, interpolation: "cubic" },
        });
        const region = await pyramid.load({ lod: 4, x: 5, y: 6 });

        expect(pyramid.sourceMaxLOD).toBe(2);
        expect(pyramid.maxLOD).toBe(4);
        expect(Math.max(...loads)).toBe(2);
        expect(region?.ancestor).toEqual({ lod: 4, x: 5, y: 6 });
        // A linear field stays linear through every generation: level 4 samples lie at a quarter of level 2 samples.
        expect(region!.sample(0, 0)).toBeCloseTo((2 * 5 * size + 6 * size) / 4, 4);
    });

    it("rejects generated levels above the source", () => {
        expect(() => new RasterPyramid({ registration: "area", load: () => Promise.resolve(undefined), maxLOD: 3, generation: { maxLOD: 2 } })).toThrow(RangeError);
    });
});
