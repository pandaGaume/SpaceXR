import { VertexBuffer } from "@babylonjs/core/Buffers/buffer.js";
import { Observable } from "@babylonjs/core/Misc/observable.js";
import { DemPyramid, createHeightGrid } from "@spacexr/dem";
import { NeighborLod } from "@spacexr/grid";
import { ResidentTiles, TileNeighbor, type ITileAddress } from "@spacexr/tiles";
import { afterEach, describe, expect, it, vi } from "vitest";

import { BabylonGeodesicGridPipeline, webMercatorTiling, type IBabylonGeodesicGridHandle } from "../src";
import { MeshRasterDrape } from "../src/draping/mesh/mesh-raster-drape";
import type { BabylonRasterPages } from "../src/raster/raster-pages";
import { TextureArrayPool } from "../src/raster/texture-array-pool";
import { createNullScene } from "./helpers";

// Page tables are exercised without requiring a WebGL context. The geometry is real Babylon mesh data.
vi.mock("../src/raster/texture-array-pool", async () => {
    const { Observable } = await import("@babylonjs/core/Misc/observable.js");
    return {
        TextureArrayPool: class {
            public readonly onGrowObservable = new Observable();
            public readonly layersKeptOnGrowth = true;
            public readonly writes = new Map<number, Float32Array>();
            private next = 0;
            public reserve() {
                return this.next++;
            }
            public release(layer: number) {
                this.writes.delete(layer);
            }
            public write(layer: number, data: Float32Array) {
                this.writes.set(layer, Float32Array.from(data));
            }
            public dispose() {
                this.onGrowObservable.clear();
            }
        },
    };
});

function labels(): HTMLElement {
    return {
        ownerDocument: { createElement: () => ({ style: { setProperty: () => undefined, display: "" }, remove: () => undefined }) },
        append: () => undefined,
    } as unknown as HTMLElement;
}

function flatPyramid(cacheEntries = 64): DemPyramid {
    return new DemPyramid({
        registration: "point",
        maxLOD: 6,
        cacheEntries,
        load: async () => createHeightGrid(17, 17, new Float32Array(17 * 17)),
    });
}

function pipelineOf(
    pyramid = flatPyramid(),
    scene = createNullScene(),
    drape?: MeshRasterDrape,
    cells = 4,
    geometrySelection: "runtime" | "draped" = "runtime",
) {
    const pipeline = new BabylonGeodesicGridPipeline(
        scene,
        labels(),
        {
            wireframe: false,
            tiling: webMercatorTiling(),
            elevation: { pyramid },
            geometrySelection,
            junctionBudgetMilliseconds: 0,
            ...(drape ? { drape } : {}),
        },
        cells,
    );
    const applied = vi.spyOn(
        pipeline as unknown as { applyGeometry: (handle: IBabylonGeodesicGridHandle, lods: unknown) => void },
        "applyGeometry",
    );
    return { pipeline, applied, scene, pyramid };
}

async function activate(pipeline: BabylonGeodesicGridPipeline, address: ITileAddress) {
    let handle: IBabylonGeodesicGridHandle | undefined;
    const ready = vi.fn(async (_id: string, result: { handle: IBabylonGeodesicGridHandle }) => {
        handle = result.handle;
        return true;
    });
    const failed = vi.fn(async () => undefined);
    await pipeline.activate({
        tile: {
            id: `${address.lod}/${address.x}/${address.y}`,
            source: { metadata: { class: "t", properties: { lod: address.lod, x: address.x, y: address.y } } },
        },
        pendingContents: [{ id: "c", uri: "u" }],
        signal: new AbortController().signal,
        readiness: { ready, failed, cancelled: async () => undefined },
    } as never);
    return { handle: handle!, ready, failed };
}

function present(pipeline: BabylonGeodesicGridPipeline, handle: IBabylonGeodesicGridHandle) {
    pipeline.present({ resources: [{ handle, metadataHandle: handle.metadataHandle }] } as never);
}

function hide(pipeline: BabylonGeodesicGridPipeline, handle: IBabylonGeodesicGridHandle) {
    pipeline.hide({ resources: [{ handle, metadataHandle: handle.metadataHandle }] } as never);
}

function vertexAt(handle: IBabylonGeodesicGridHandle, u: number, v: number): number[] {
    const uvs = handle.mesh.getVerticesData(VertexBuffer.UVKind)!;
    const positions = handle.mesh.getVerticesData(VertexBuffer.PositionKind)!;
    for (let vertex = 0; vertex < uvs.length / 2; vertex++) {
        if (uvs[vertex * 2] === u && uvs[vertex * 2 + 1] === 1 - v) return Array.from(positions.slice(vertex * 3, vertex * 3 + 3));
    }
    throw new Error(`Missing shared vertex ${u},${v}`);
}

describe("Mercator geometry selected by the runtime", () => {
    afterEach(() => vi.restoreAllMocks());

    it("finishes every changed junction before drawing even with a zero legacy budget", async () => {
        const { pipeline, applied } = pipelineOf();
        const fine = await Promise.all([2, 3, 4].map(async (y) => (await activate(pipeline, { lod: 3, x: 3, y })).handle));
        const coarse = await Promise.all([1, 2].map(async (y) => (await activate(pipeline, { lod: 2, x: 2, y })).handle));
        applied.mockClear();
        for (const handle of [...fine, ...coarse]) present(pipeline, handle);
        pipeline.updateJunctions();
        for (const handle of fine) {
            expect(handle.lods[TileNeighbor.E]).toBe(NeighborLod.Coarser);
            expect(applied.mock.calls.some(([rebuilt]) => rebuilt === handle)).toBe(true);
        }
        const calls = applied.mock.calls.length;
        pipeline.updateJunctions();
        expect(applied).toHaveBeenCalledTimes(calls);
        pipeline.dispose();
    });

    it("forgets a hidden neighbour instead of keeping geometry outside the published cut", async () => {
        const { pipeline } = pipelineOf();
        const fine = (await activate(pipeline, { lod: 3, x: 3, y: 3 })).handle;
        const coarse = (await activate(pipeline, { lod: 2, x: 2, y: 1 })).handle;
        present(pipeline, fine);
        present(pipeline, coarse);
        pipeline.updateJunctions();
        expect(fine.lods[TileNeighbor.E]).toBe(NeighborLod.Coarser);
        hide(pipeline, coarse);
        pipeline.updateJunctions();
        expect(fine.lods[TileNeighbor.E]).toBe(NeighborLod.Same);
        pipeline.dispose();
    });

    it("does not scan or rebuild the cut for repeated present and hide calls", async () => {
        const { pipeline, applied } = pipelineOf();
        const handle = (await activate(pipeline, { lod: 3, x: 3, y: 3 })).handle;
        present(pipeline, handle);
        pipeline.updateJunctions();
        applied.mockClear();
        present(pipeline, handle);
        pipeline.updateJunctions();
        expect(applied).not.toHaveBeenCalled();
        hide(pipeline, handle);
        pipeline.updateJunctions();
        const edgeLods = vi.spyOn((pipeline as unknown as { displayed: { edgeLods: () => unknown } }).displayed, "edgeLods");
        hide(pipeline, handle);
        pipeline.updateJunctions();
        expect(edgeLods).not.toHaveBeenCalled();
        pipeline.dispose();
    });

    it("keeps the DEM of a cached ready ancestor until its handle is released", async () => {
        const pyramid = flatPyramid(1);
        const { pipeline } = pipelineOf(pyramid);
        const first = { lod: 3, x: 3, y: 3 };
        const handle = (await activate(pipeline, first)).handle;
        present(pipeline, handle);
        hide(pipeline, handle);
        await pyramid.tileHeights({ lod: 3, x: 4, y: 3 });
        expect(pyramid.isResident(first)).toBe(true);
        pipeline.release({ resources: [{ handle, metadataHandle: handle.metadataHandle }] } as never);
        await pyramid.tileHeights({ lod: 3, x: 5, y: 3 });
        expect(pyramid.isResident(first)).toBe(false);
        pipeline.dispose();
    });

    it("does not report a ready terrain when its configured DEM has no usable source", async () => {
        const pyramid = new DemPyramid({ registration: "point", maxLOD: 3, load: async () => undefined });
        const { pipeline } = pipelineOf(pyramid);
        const { ready, failed } = await activate(pipeline, { lod: 3, x: 3, y: 3 });
        expect(ready).not.toHaveBeenCalled();
        expect(failed).toHaveBeenCalledTimes(1);
        expect(pipeline.getStatistics().created).toBe(0);
        pipeline.dispose();
    });

    it("joins fine and coarse geometry beyond the measured DEM with cubic generated heights", async () => {
        const loaded: ITileAddress[] = [];
        const size = 8;
        const pyramid = new DemPyramid({
            registration: "area",
            maxLOD: 2,
            generation: { maxLOD: 4, interpolation: "cubic" },
            wrapX: true,
            load: async (address) => {
                loaded.push(address);
                const count = 2 ** address.lod;
                const data = new Float32Array(size * size);
                for (let y = 0; y < size; y++)
                    for (let x = 0; x < size; x++) {
                        const u = (address.x + (x + 0.5) / size) / count;
                        const v = (address.y + (y + 0.5) / size) / count;
                        data[y * size + x] = 100 * Math.sin(4 * u) + 30 * v * v;
                    }
                return createHeightGrid(size, size, data);
            },
        });
        const { pipeline } = pipelineOf(pyramid);
        const coarse = (await activate(pipeline, { lod: 3, x: 3, y: 3 })).handle;
        const fine = (await activate(pipeline, { lod: 4, x: 8, y: 6 })).handle;
        const below = (await activate(pipeline, { lod: 4, x: 8, y: 7 })).handle;
        present(pipeline, coarse);
        present(pipeline, fine);
        present(pipeline, below);
        pipeline.updateJunctions();
        expect(fine.lods[TileNeighbor.W]).toBe(NeighborLod.Coarser);
        expect(coarse.lods[TileNeighbor.E]).toBe(NeighborLod.Same);
        for (const v of [0, 0.5, 1]) expect(vertexAt(fine, 0, v)).toEqual(vertexAt(coarse, 1, v * 0.5));
        expect(loaded.length).toBeGreaterThan(0);
        expect(loaded.every((address) => address.lod <= 2)).toBe(true);
        pipeline.dispose();
    });

    it("reuses interior positions and normals when only a border joins a coarse neighbour", async () => {
        const { pipeline, pyramid, applied } = pipelineOf(flatPyramid(), createNullScene(), undefined, 32);
        const coarse = (await activate(pipeline, { lod: 3, x: 3, y: 3 })).handle;
        const fine = (await activate(pipeline, { lod: 4, x: 8, y: 6 })).handle;
        const positions = Array.from(fine.mesh.getVerticesData(VertexBuffer.PositionKind)!);
        const normals = Array.from(fine.mesh.getVerticesData(VertexBuffer.NormalKind)!);
        present(pipeline, coarse);
        pipeline.updateJunctions();
        applied.mockClear();
        const gradients = vi.spyOn(pyramid, "surfaceGradient");
        present(pipeline, fine);
        pipeline.updateJunctions();
        expect(fine.lods[TileNeighbor.W]).toBe(NeighborLod.Coarser);
        expect(gradients).toHaveBeenCalledTimes(4 * 32);
        // Same and finer neighbours do not change the surface sampled by the coarse tile.
        expect(applied.mock.calls.some(([handle]) => handle === coarse)).toBe(false);
        const nextPositions = fine.mesh.getVerticesData(VertexBuffer.PositionKind)!;
        const nextNormals = fine.mesh.getVerticesData(VertexBuffer.NormalKind)!;
        for (let row = 1; row < 32; row++)
            for (let column = 1; column < 32; column++) {
                const offset = (row * 33 + column) * 3;
                expect(Array.from(nextPositions.slice(offset, offset + 3))).toEqual(positions.slice(offset, offset + 3));
                expect(Array.from(nextNormals.slice(offset, offset + 3))).toEqual(normals.slice(offset, offset + 3));
            }
        pipeline.dispose();
    });

    it("invalidates interior samples for changed DEM data and vertical scale, but ignores unrelated pages", async () => {
        const pyramid = flatPyramid();
        let changed: ((addresses: readonly ITileAddress[]) => void) | undefined;
        const subscribe = pyramid.rasters.observeStitched.bind(pyramid.rasters);
        vi.spyOn(pyramid.rasters, "observeStitched").mockImplementation((listener) => {
            changed = listener;
            return subscribe(listener);
        });
        const { pipeline, applied } = pipelineOf(pyramid);
        const address = { lod: 3, x: 3, y: 3 };
        const handle = (await activate(pipeline, address)).handle;
        present(pipeline, handle);
        pipeline.updateJunctions();
        applied.mockClear();
        changed!([{ lod: 3, x: 0, y: 0 }]);
        pipeline.updateJunctions();
        expect(applied).not.toHaveBeenCalled();

        const before = vertexAt(handle, 0.5, 0.5);
        pyramid.rasters.stitchedGrid(address)!.data.fill(20);
        const gradients = vi.spyOn(pyramid, "surfaceGradient");
        changed!([address]);
        pipeline.updateJunctions();
        expect(gradients.mock.calls.length).toBe(16);
        expect(vertexAt(handle, 0.5, 0.5)).not.toEqual(before);
        gradients.mockClear();
        pipeline.setVerticalScale(3);
        expect(gradients.mock.calls.length).toBe(16);
        const elevated = handle.elevated!;
        const center = 12;
        const expected = [0, 1, 2].map((axis) => Math.fround(elevated.base[center * 3 + axis]! + elevated.up[center * 3 + axis]! * 60));
        expect(vertexAt(handle, 0.5, 0.5)).toEqual(expected);
        pipeline.dispose();
    });

    it.each(["measured", "ancestor", "generated"] as const)(
        "matches pyramid-derived interior normals with a local %s DEM sampler",
        async (kind) => {
            const sourceLevel = kind === "measured" ? 3 : 2;
            const geometryLevel = kind === "measured" ? 3 : 4;
            const size = kind === "generated" ? 8 : 17;
            const pyramid = new DemPyramid({
                registration: kind === "generated" ? "area" : "point",
                maxLOD: sourceLevel,
                ...(kind === "generated" ? { generation: { maxLOD: geometryLevel, interpolation: "cubic" as const }, wrapX: true } : {}),
                load: async (address) => {
                    const count = 2 ** address.lod;
                    const data = new Float32Array(size * size);
                    for (let y = 0; y < size; y++)
                        for (let x = 0; x < size; x++) {
                            const u = (address.x + (kind === "generated" ? (x + 0.5) / size : x / (size - 1))) / count;
                            const v = (address.y + (kind === "generated" ? (y + 0.5) / size : y / (size - 1))) / count;
                            data[y * size + x] = 250 * Math.sin(7 * u) + 90 * Math.cos(5 * v) + 30 * u * v;
                        }
                    return createHeightGrid(size, size, data);
                },
            });
            const cells = 16;
            const address = { lod: geometryLevel, x: 2 ** (geometryLevel - 1), y: 2 ** (geometryLevel - 1) - 1 };
            const modern = pipelineOf(pyramid, createNullScene(), undefined, cells);
            const gradients = vi.spyOn(pyramid, "surfaceGradient");
            const actual = (await activate(modern.pipeline, address)).handle;
            expect(gradients).toHaveBeenCalledTimes(4 * cells);
            gradients.mockClear();
            const reference = pipelineOf(pyramid, createNullScene(), undefined, cells, "draped");
            const expected = (await activate(reference.pipeline, address)).handle;
            expect(gradients).toHaveBeenCalledTimes((cells + 1) ** 2);
            const actualNormals = actual.mesh.getVerticesData(VertexBuffer.NormalKind)!;
            const expectedNormals = expected.mesh.getVerticesData(VertexBuffer.NormalKind)!;
            for (let row = 1; row < cells; row++)
                for (let column = 1; column < cells; column++) {
                    const offset = (row * (cells + 1) + column) * 3;
                    for (let axis = 0; axis < 3; axis++)
                        expect(actualNormals[offset + axis]).toBeCloseTo(expectedNormals[offset + axis]!, 6);
                }
            modern.pipeline.dispose();
            reference.pipeline.dispose();
        },
    );

    it("keeps the measured DEM, generated geometry and imagery levels independent", async () => {
        const scene = createNullScene();
        const loaded: ITileAddress[] = [];
        const pyramid = new DemPyramid({
            registration: "area",
            maxLOD: 3,
            generation: { maxLOD: 5, interpolation: "cubic" },
            wrapX: true,
            load: async (address) => {
                loaded.push(address);
                return createHeightGrid(8, 8, new Float32Array(64).fill(125));
            },
        });
        const imagery = {
            pool: new TextureArrayPool(scene, { size: 3 }),
            resident: new ResidentTiles<number>(),
            presented: new ResidentTiles<true>(),
            changed: new Observable<ITileAddress>(),
        };
        const drape = new MeshRasterDrape(scene, imagery as unknown as BabylonRasterPages, { maxDepth: 3, depthHoldMilliseconds: 0 });
        const { pipeline, applied } = pipelineOf(pyramid, scene, drape);
        // A L3 measured DEM covers 8 x 8 images at L6. This geometry is independently L5.
        const handle = (await activate(pipeline, { lod: 5, x: 12, y: 12 })).handle;
        present(pipeline, handle);
        pipeline.updateJunctions();
        const positions = Array.from(handle.mesh.getVerticesData(VertexBuffer.PositionKind)!);
        const indices = Array.from(handle.mesh.getIndices()!);
        applied.mockClear();
        for (let y = 0; y < 8; y++)
            for (let x = 0; x < 8; x++) {
                const page = { lod: 6, x: 3 * 8 + x, y: 3 * 8 + y };
                imagery.resident.set(page, y * 8 + x);
                imagery.presented.set(page, true);
                imagery.changed.notifyObservers(page);
            }
        drape.update();
        pipeline.updateJunctions();
        expect(handle.identity.lod).toBe(5);
        expect(drape.drapeOf(handle.mesh)?.depth).toBe(1);
        expect(drape.getStatistics().exactCells).toBe(4);
        expect(loaded.length).toBeGreaterThan(0);
        expect(loaded.every((address) => address.lod <= 3)).toBe(true);
        expect(Array.from(handle.mesh.getVerticesData(VertexBuffer.PositionKind)!)).toEqual(positions);
        expect(Array.from(handle.mesh.getIndices()!)).toEqual(indices);
        expect(applied).not.toHaveBeenCalled();
        pipeline.dispose();
        drape.dispose();
    });

    it.each([2, 4, 8])("drapes %i imagery pages per side without changing geometry", async (n) => {
        const scene = createNullScene();
        const imagery = {
            pool: new TextureArrayPool(scene, { size: 3 }),
            resident: new ResidentTiles<number>(),
            presented: new ResidentTiles<true>(),
            changed: new Observable<ITileAddress>(),
        };
        const drape = new MeshRasterDrape(scene, imagery as unknown as BabylonRasterPages, { maxDepth: 3, depthHoldMilliseconds: 0 });
        const { pipeline, applied } = pipelineOf(flatPyramid(), scene, drape);
        const address = { lod: 3, x: 3, y: 3 };
        const handle = (await activate(pipeline, address)).handle;
        present(pipeline, handle);
        pipeline.updateJunctions();
        const positions = Array.from(handle.mesh.getVerticesData(VertexBuffer.PositionKind)!);
        const indices = Array.from(handle.mesh.getIndices()!);
        applied.mockClear();
        for (let y = 0; y < n; y++)
            for (let x = 0; x < n; x++) {
                const page = { lod: address.lod + Math.log2(n), x: address.x * n + x, y: address.y * n + y };
                imagery.resident.set(page, y * n + x);
                imagery.presented.set(page, true);
                imagery.changed.notifyObservers(page);
            }
        drape.update();
        pipeline.updateJunctions();
        expect(drape.drapeOf(handle.mesh)?.depth).toBe(Math.log2(n));
        expect(drape.getStatistics().exactCells).toBe(n * n);
        expect(Array.from(handle.mesh.getVerticesData(VertexBuffer.PositionKind)!)).toEqual(positions);
        expect(Array.from(handle.mesh.getIndices()!)).toEqual(indices);
        expect(applied).not.toHaveBeenCalled();
        pipeline.dispose();
        drape.dispose();
    });
});
