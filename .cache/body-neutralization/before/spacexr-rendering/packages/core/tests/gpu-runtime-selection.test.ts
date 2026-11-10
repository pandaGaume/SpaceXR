import { Observable } from "@babylonjs/core/Misc/observable.js";
import { ResidentTiles, type ITileAddress } from "@spacexr/tiles";
import { describe, expect, it, vi } from "vitest";

import type { BabylonRasterPages } from "../src/raster/raster-pages";
import type { IGridElevationOptions } from "../src/terrain/mesh/geodesic-grid-pipeline";
import { GpuTerrainEngine } from "../src/terrain/gpu/gpu-terrain-engine";
import { GpuRasterDrape } from "../src/terrain/gpu/gpu-raster-drape";
import { runtimeGridTopology } from "../src/terrain/gpu/instanced-grid";
import { createNullScene } from "./helpers";

vi.mock("../src/raster/texture-array-pool", () => ({
    TextureArrayPool: class {
        public readonly onGrowObservable = new Observable();
        public readonly layersKeptOnGrowth = true;
        public readonly writes = new Map<number, Float32Array>();
        public readonly gpuBytes = 0;
        private used = 0;
        private free: number[] = [];
        public reserve() {
            return this.free.pop() ?? this.used++;
        }
        public release(layer: number) {
            this.free.push(layer);
        }
        public write(layer: number, data: Float32Array) {
            this.writes.set(layer, data.slice());
        }
        public dispose() {
            this.onGrowObservable.clear();
        }
    },
}));

function pages() {
    return {
        pool: {},
        size: 257,
        resident: new ResidentTiles<number>(),
        presented: new ResidentTiles<boolean>(),
        changed: new Observable<ITileAddress>(),
    };
}

function present(engine: GpuTerrainEngine, identity: ITileAddress) {
    const handle = { identity, presented: false };
    engine.present({ resources: [{ handle }] } as unknown as Parameters<GpuTerrainEngine["present"]>[0]);
    return handle;
}

describe("Mercator runtime GPU geometry", () => {
    it.each([1, 2, 3])("keeps one geometry while %i levels of finer imagery are added", (depth) => {
        const scene = createNullScene();
        const imagery = pages();
        const engine = new GpuTerrainEngine(
            {
                scene,
                labelLayer: {} as HTMLElement,
                wireframe: false,
                junctions: "fine",
                edgeHeights: "coarsest",
                geometrySelection: "runtime",
                imageryPages: imagery as unknown as BabylonRasterPages,
            },
            { cells: 8 },
        );
        const address = { lod: 5, x: 10, y: 10 };
        present(engine, address);
        engine.beforeRender();
        const geometry = engine.geometryTiles;
        const updateGeometry = vi.spyOn(engine.pickSurface, "update");
        const side = 2 ** depth;
        for (let y = 0; y < side; y++)
            for (let x = 0; x < side; x++) {
                const page = { lod: address.lod + depth, x: address.x * side + x, y: address.y * side + y };
                imagery.resident.set(page, y * side + x);
                imagery.presented.set(page, true);
                imagery.changed.notifyObservers(page);
            }
        engine.beforeRender();
        expect(engine.geometryTiles).toEqual(geometry);
        expect(updateGeometry).not.toHaveBeenCalled();
        expect(engine.instanceCount).toBe(1);
        expect(engine.shapes).toBeUndefined();
        expect([...engine.grids.values()].reduce((sum, grid) => sum + grid.count, 0)).toBe(1);
        expect(engine.grid.attribute("instImagery")[0]).toBe(depth);
        engine.dispose();
        scene.dispose();
    });

    it("updates provider-normal bindings independently of the geometry and DEM cut", async () => {
        const scene = createNullScene();
        const resident = new ResidentTiles<number>(),
            changed = new Observable<ITileAddress>();
        let complete: (() => void) | undefined;
        const normalPages = {
            resident,
            changed,
            pool: { gpuBytes: 0 },
            size: 257,
            pyramid: {
                areaOf: (address: ITileAddress) => {
                    const lod = Math.min(15, address.lod),
                        scale = 2 ** (address.lod - lod);
                    return { ancestor: { lod, x: Math.floor(address.x / scale), y: Math.floor(address.y / scale) } };
                },
                retain: () => undefined,
                release: () => undefined,
            },
            release: (address: ITileAddress) => resident.delete(address),
            load: (address: ITileAddress) =>
                new Promise((resolve) => {
                    complete = () => {
                        resident.set(address, 7);
                        changed.notifyObservers(address);
                        resolve({ address, layer: 7 });
                    };
                }),
        };
        const engine = new GpuTerrainEngine(
            {
                scene,
                labelLayer: {} as HTMLElement,
                wireframe: false,
                junctions: "fine",
                edgeHeights: "coarsest",
                geometrySelection: "runtime",
                normalPages: normalPages as unknown as BabylonRasterPages,
            },
            { cells: 8 },
        );
        present(engine, { lod: 18, x: 804, y: 1602 });
        engine.beforeRender();
        const geometry = engine.geometryTiles,
            pick = vi.spyOn(engine.pickSurface, "update");
        expect([...engine.grid.attribute("instNormal").slice(0, 4)]).toEqual([0, 0, 1, -1]);
        complete!();
        for (let i = 0; i < 5; i++) await Promise.resolve();
        engine.beforeRender();
        expect([...engine.grid.attribute("instNormal").slice(0, 4)]).toEqual([0.5, 0.25, 0.125, 7]);
        expect(engine.geometryTiles).toEqual(geometry);
        expect(pick).not.toHaveBeenCalled();
        engine.dispose();
        scene.dispose();
    });

    it("keeps shared DEM texels when replacing a tile by children served by the same source", () => {
        const scene = createNullScene();
        const grid = { width: 257, height: 257, channels: 1, data: new Float32Array(257 * 257) };
        const areaOf = (address: ITileAddress) => {
            const level = Math.min(address.lod, 3),
                scale = 2 ** (address.lod - level);
            return {
                ancestor: { lod: level, x: Math.floor(address.x / scale), y: Math.floor(address.y / scale) },
                west: 0,
                north: 0,
                size: 1,
            };
        };
        const pyramid = {
            retain: () => undefined,
            release: () => undefined,
            isResident: () => true,
            heightAt: () => 0,
            rasters: { areaOf, stitchedGrid: () => grid, observeStitched: () => () => undefined },
        };
        const engine = new GpuTerrainEngine(
            {
                scene,
                labelLayer: {} as HTMLElement,
                wireframe: true,
                junctions: "fine",
                edgeHeights: "coarsest",
                geometrySelection: "runtime",
                elevation: { pyramid } as unknown as IGridElevationOptions,
            },
            { cells: 8 },
        );
        const coarse = present(engine, { lod: 5, x: 10, y: 10 });
        engine.beforeRender();
        const write = vi.spyOn(engine.elevations.pool, "write");
        engine.hide({ resources: [{ handle: coarse }] } as unknown as Parameters<GpuTerrainEngine["hide"]>[0]);
        for (let y = 0; y < 2; y++) for (let x = 0; x < 2; x++) present(engine, { lod: 6, x: 20 + x, y: 20 + y });
        engine.beforeRender();
        expect(engine.instanceCount).toBe(4);
        expect(write).not.toHaveBeenCalled();
        engine.dispose();
        scene.dispose();
    });

    it("groups a balanced cut by fine-side index variants without adding tiles", () => {
        const scene = createNullScene();
        const engine = new GpuTerrainEngine(
            {
                scene,
                labelLayer: {} as HTMLElement,
                wireframe: true,
                junctions: "fine",
                edgeHeights: "coarsest",
                geometrySelection: "runtime",
            },
            { cells: 8 },
        );
        const cut = [
            { lod: 5, x: 10, y: 10 },
            { lod: 6, x: 22, y: 20 },
            { lod: 6, x: 22, y: 21 },
        ];
        for (const tile of cut) present(engine, tile);
        engine.beforeRender();
        expect(engine.geometryTiles).toEqual(cut);
        expect(engine.instanceCount).toBe(3);
        expect(engine.grids.get(0)!.count).toBe(1);
        expect(engine.grids.get(8)!.count).toBe(2);
        const topology = runtimeGridTopology(8, 8);
        const west = Array.from({ length: topology.coordinates.length / 2 }, (_, i) => [
            topology.coordinates[2 * i]!,
            topology.coordinates[2 * i + 1]!,
        ]).filter(([u]) => u === 0);
        expect(west.map(([, v]) => v)).toEqual([0, 0.25, 0.5, 0.75, 1]);
        engine.dispose();
        scene.dispose();
    });
});

describe("GPU imagery indirection", () => {
    it.each([1, 2, 3])("stores all %i-level pages with independent cells and ancestor fallback", (depth) => {
        const scene = createNullScene();
        const imagery = pages();
        const tile = { lod: 5, x: 10, y: 10 };
        imagery.resident.set(tile, 100);
        const side = 2 ** depth;
        const fine = { lod: 5 + depth, x: 10 * side, y: 10 * side };
        imagery.resident.set(fine, 200);
        imagery.presented.set(fine, true);
        const drape = new GpuRasterDrape(scene, imagery as unknown as BabylonRasterPages, 3);
        drape.sync([tile]);
        const binding = drape.binding(tile)!;
        const table = (drape.tables as unknown as { writes: Map<number, Float32Array> }).writes.get(binding.tableLayer)!;
        expect(binding.depth).toBe(depth);
        expect(table.length).toBe(4 * side * side);
        expect(table[0]).toBe(200);
        expect(table[4]).toBe(100);
        expect(table[7]).toBe(1 / side);
        drape.dispose();
        scene.dispose();
    });
});
