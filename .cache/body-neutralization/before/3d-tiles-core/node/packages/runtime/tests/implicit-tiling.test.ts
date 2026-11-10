import type { IImplicitTiling, ISubtree, ITileset } from "@spacexr/3d-tiles-core";
import { SubtreeCodec } from "@spacexr/3d-tiles-core";
import { describe, expect, it } from "vitest";

import type {
    IContentLoadContext,
    IImplicitSubtreeLoadRequest,
    ILoadedImplicitSubtree,
    IRuntimeAdapter,
    ISpatialDerivationContext,
    ISpatialMetric,
} from "../src";
import {
    createWebMapImplicitSource,
    DenseImplicitSubtreeLoader,
    implicitAvailabilityIndex,
    implicitMortonIndex,
    LoadedSubtreeAvailability,
    StandardImplicitSubtreeLoader,
    subdivideImplicitBoundingVolume,
    TileRuntime,
} from "../src";

interface ICamera {
    multiplier: number;
}

interface ISpatial {
    geometricError: number;
    heights?: number[];
}

interface IHandle {
    uri: string;
}

class TestSpatialMetric implements ISpatialMetric<ICamera, ISpatial> {
    public derive(context: ISpatialDerivationContext<ISpatial>): ISpatial {
        return { geometricError: context.tile.geometricError };
    }

    public isVisible(): boolean {
        return true;
    }

    public screenSpaceError(context: { camera: ICamera; spatial: ISpatial }): number {
        return context.camera.multiplier * context.spatial.geometricError;
    }
}

const quadtree: IImplicitTiling = {
    subdivisionScheme: "QUADTREE",
    subtreeLevels: 2,
    availableLevels: 3,
    subtrees: { uri: "subtrees/{level}/{x}/{y}.subtree" },
};

describe("implicit tiling primitives", () => {
    it("indexes quadtree availability in level-concatenated Morton order", () => {
        expect(implicitMortonIndex({ level: 2, x: 3, y: 0 }, "QUADTREE")).toBe(5);
        expect(implicitAvailabilityIndex({ level: 2, x: 3, y: 0 }, quadtree)).toBe(10);

        const availability = new LoadedSubtreeAvailability(
            {
                subtree: {
                    buffers: [{ byteLength: 1 }],
                    bufferViews: [{ buffer: 0, byteLength: 1 }],
                    tileAvailability: { bitstream: 0 },
                    childSubtreeAvailability: { constant: 0 },
                },
                buffers: [new Uint8Array([0b00001011])],
            },
            quadtree,
        );
        expect(availability.isTileAvailable({ level: 0, x: 0, y: 0 })).toBe(true);
        expect(availability.isTileAvailable({ level: 1, x: 0, y: 0 })).toBe(true);
        expect(availability.isTileAvailable({ level: 1, x: 0, y: 1 })).toBe(true);
        expect(availability.isTileAvailable({ level: 1, x: 1, y: 0 })).toBe(false);
    });

    it("subdivides boxes in all three dimensions for octrees", () => {
        const volume = subdivideImplicitBoundingVolume({ box: [0, 0, 0, 8, 0, 0, 0, 8, 0, 0, 0, 8] }, "OCTREE", {
            level: 1,
            x: 1,
            y: 0,
            z: 1,
        });
        expect(volume.box).toEqual([4, -4, 4, 4, 0, 0, 0, 4, 0, 0, 0, 4]);
    });

    it("loads standard binary subtrees and resolves their external buffers", async () => {
        const subtree: ISubtree = {
            buffers: [{ byteLength: 1 }, { uri: "availability.bin", byteLength: 1 }],
            bufferViews: [
                { buffer: 0, byteLength: 1 },
                { buffer: 1, byteLength: 1 },
            ],
            tileAvailability: { bitstream: 0 },
            childSubtreeAvailability: { bitstream: 1 },
        };
        const binary = new SubtreeCodec().encodeBinary(subtree, { binaryChunk: new Uint8Array([1]) });
        const requests: string[] = [];
        const loader = new StandardImplicitSubtreeLoader({
            resources: {
                load: async ({ uri }) => {
                    requests.push(uri);
                    return uri.endsWith("availability.bin") ? new Uint8Array([0b00000100]) : binary;
                },
            },
        });
        const loaded = await loader.load({
            uri: "https://example.test/subtrees/0/0/0.subtree",
            documentUri: "https://example.test/tileset.json",
            coordinates: { level: 0, x: 0, y: 0 },
            implicitTiling: quadtree,
            contentCount: 0,
            signal: new AbortController().signal,
        });

        expect(requests).toEqual(["https://example.test/subtrees/0/0/0.subtree", "https://example.test/subtrees/0/0/availability.bin"]);
        expect(loaded.buffers?.map((buffer) => [...buffer])).toEqual([[1], [4]]);
    });
});

describe("TileRuntime implicit traversal", () => {
    it("loads sparse child subtrees and materializes only available branches", async () => {
        const tileset: ITileset = {
            asset: { version: "1.1" },
            geometricError: 100,
            schema: {
                id: "ImplicitMining",
                classes: {
                    Subtree: { properties: { name: { type: "STRING" } } },
                    Tile: { properties: { level: { type: "SCALAR", componentType: "UINT16" } } },
                    Content: { properties: { kind: { type: "STRING" } } },
                },
            },
            root: {
                boundingVolume: { region: [-1, -1, 1, 1, 0, 100] },
                geometricError: 100,
                refine: "REPLACE",
                content: { uri: "terrain/{level}/{x}/{y}.bin" },
                implicitTiling: quadtree,
            },
        };
        const subtreeRequests: IImplicitSubtreeLoadRequest[] = [];
        const contentRequests: IContentLoadContext<ISpatial>[] = [];
        const adapter: IRuntimeAdapter<ICamera, ISpatial, IHandle, string> = {
            tilesets: { load: async () => ({ tileset }) },
            subtrees: {
                load: async (request): Promise<ILoadedImplicitSubtree> => {
                    subtreeRequests.push(request);
                    if (request.coordinates.level === 0) {
                        return {
                            subtree: {
                                buffers: [{ byteLength: 2 }],
                                bufferViews: [{ buffer: 0, byteLength: 2 }],
                                tileAvailability: { constant: 1 },
                                contentAvailability: [{ constant: 1 }],
                                childSubtreeAvailability: { bitstream: 0, availableCount: 2 },
                                subtreeMetadata: { class: "Subtree", properties: { name: "root subtree" } },
                            },
                            buffers: [new Uint8Array([0b00000001, 0b10000000])],
                        };
                    }
                    return {
                        subtree: {
                            tileAvailability: { constant: 1 },
                            contentAvailability: [{ constant: 1 }],
                            childSubtreeAvailability: { constant: 0 },
                            subtreeMetadata: { class: "Subtree", properties: { name: "leaf subtree" } },
                        },
                    };
                },
            },
            implicitMetadata: {
                decode: ({ coordinates, contentCount }) => ({
                    tileMetadata: { class: "Tile", properties: { level: coordinates.level } },
                    contentMetadata: Array.from({ length: contentCount }, () => ({
                        class: "Content",
                        properties: { kind: "DEM" },
                    })),
                }),
            },
            spatial: new TestSpatialMetric(),
            content: {
                load: async (context) => {
                    contentRequests.push(context);
                    return { kind: "renderable", handle: { uri: context.uri } };
                },
                attach: () => undefined,
                detach: () => undefined,
            },
        };
        const runtime = new TileRuntime({
            id: "sparse",
            uri: "https://example.test/tileset.json",
            adapter,
            maxScreenSpaceError: 10,
        });
        const metadataScopes: string[][] = [];
        runtime.events.subscribe((event) => {
            if (event.type === "metadata-resolved") metadataScopes.push(event.snapshot.scopes.map((scope) => scope.scope));
        });

        await runtime.update({ multiplier: 1 });
        await runtime.whenIdle();

        expect(subtreeRequests.map((request) => [request.coordinates.level, request.coordinates.x, request.coordinates.y])).toEqual(
            expect.arrayContaining([
                [0, 0, 0],
                [2, 0, 0],
                [2, 3, 3],
            ]),
        );
        expect(subtreeRequests).toHaveLength(3);
        expect(runtime.selectedTiles.map((tile) => tile.implicit?.coordinates)).toEqual(
            expect.arrayContaining([
                { level: 2, x: 0, y: 0 },
                { level: 2, x: 3, y: 3 },
            ]),
        );
        expect(contentRequests.some((request) => request.uri.endsWith("terrain/2/3/3.bin"))).toBe(true);
        expect(contentRequests.every((request) => request.content.metadata?.class === "Content")).toBe(true);
        expect(metadataScopes.some((scopes) => scopes.includes("subtree") && scopes.includes("tile") && scopes.includes("content"))).toBe(
            true,
        );
        await runtime.dispose();
    });

    it("adapts an XYZ Web Mercator DEM pyramid and exposes coordinates to the terrain adapter", async () => {
        const source = createWebMapImplicitSource({
            urlTemplates: "https://dem.example.test/{z}/{x}/{y}.png",
            maximumZoom: 1,
            subtreeLevels: 2,
            minimumHeight: -100,
            maximumHeight: 4000,
        });
        const requests: IContentLoadContext<ISpatial>[] = [];
        const adapter: IRuntimeAdapter<ICamera, ISpatial, IHandle, string> = {
            tilesets: { load: async () => ({ tileset: source.tileset }) },
            subtrees: new DenseImplicitSubtreeLoader(),
            implicitTiles: source.resolver,
            spatial: new TestSpatialMetric(),
            content: {
                load: async (context) => {
                    requests.push(context);
                    return { kind: "renderable", handle: { uri: context.uri } };
                },
                attach: () => undefined,
                detach: () => undefined,
            },
        };
        const runtime = new TileRuntime({ id: "dem", uri: "memory://dem/tileset.json", adapter, maxScreenSpaceError: 1 });

        await runtime.update({ multiplier: 1 });
        await runtime.whenIdle();

        const levelOne = requests.filter((request) => request.implicitCoordinates?.level === 1);
        expect(levelOne.map((request) => request.uri)).toEqual(
            expect.arrayContaining([
                "https://dem.example.test/1/0/1.png",
                "https://dem.example.test/1/1/1.png",
                "https://dem.example.test/1/0/0.png",
                "https://dem.example.test/1/1/0.png",
            ]),
        );
        expect(levelOne.every((request) => request.tile.boundingVolume.region?.[4] === -100)).toBe(true);
        expect(levelOne.every((request) => request.tile.boundingVolume.region?.[5] === 4000)).toBe(true);
        await runtime.dispose();
    });

    it("re-resolves child bounds from parent content, except for children with measured content bounds", async () => {
        const source = createWebMapImplicitSource({
            urlTemplates: "https://dem.example.test/{z}/{x}/{y}.png",
            maximumZoom: 1,
            subtreeLevels: 2,
        });
        // Child height ranges prepared by the parent content, keyed by implicit coordinates.
        const prepared = new Map<string, [number, number]>();
        let releaseRoot!: () => void;
        const rootGate = new Promise<void>((resolve) => (releaseRoot = resolve));
        const heights = new Map<string, number[]>();
        const origins: string[] = [];
        const adapter: IRuntimeAdapter<ICamera, ISpatial, IHandle, string> = {
            tilesets: { load: async () => ({ tileset: source.tileset }) },
            subtrees: new DenseImplicitSubtreeLoader(),
            implicitTiles: {
                resolve: (context) => {
                    const override = source.resolver.resolve(context);
                    const region = override?.boundingVolume?.region;
                    const range = prepared.get(`${context.coordinates.level}/${context.coordinates.x}/${context.coordinates.y}`) ?? [0, 0];
                    return region
                        ? { ...override, boundingVolume: { region: [region[0], region[1], region[2], region[3], ...range] } }
                        : override;
                },
            },
            spatial: {
                derive: (context) => ({
                    geometricError: context.tile.geometricError,
                    heights: context.tile.boundingVolume.region!.slice(4),
                }),
                isVisible: () => true,
                screenSpaceError: (context) => context.camera.multiplier * context.spatial.geometricError,
            },
            content: {
                load: async (context) => {
                    const { level, x, y } = context.implicitCoordinates!;
                    if (level === 0) {
                        await rootGate;
                        for (const [cx, cy] of [
                            [0, 0],
                            [1, 0],
                            [0, 1],
                            [1, 1],
                        ] as const)
                            prepared.set(`1/${cx}/${cy}`, [100 * (cx + 2 * cy), 100 * (cx + 2 * cy) + 50]);
                    }
                    const measured =
                        level === 1 && x === 0 && y === 0
                            ? { tileBoundingVolume: { region: [0, 0, 0, 0, 7, 8] as [number, number, number, number, number, number] } }
                            : {};
                    return { kind: "renderable", handle: { uri: context.uri }, ...measured };
                },
                attach: () => undefined,
                detach: () => undefined,
            },
        };
        const runtime = new TileRuntime({ id: "dem", uri: "memory://dem/tileset.json", adapter, maxScreenSpaceError: 1 });
        runtime.events.subscribe((event) => {
            if (event.type === "tile-bounds-refined")
                origins.push(`${event.tile.implicit?.coordinates.x}/${event.tile.implicit?.coordinates.y}:${event.origin}`);
        });

        // Let the subtree load and the children materialize and load while the root content is still pending.
        for (let frame = 0; frame < 5; frame++) {
            await runtime.update({ multiplier: 1 });
            await new Promise((resolve) => setTimeout(resolve, 0));
        }
        const levelOne = runtime.root!.children.filter((child) => child.implicit?.coordinates.level === 1);
        expect(levelOne).toHaveLength(4);
        for (const child of levelOne)
            heights.set(
                `${child.implicit!.coordinates.x}/${child.implicit!.coordinates.y}`,
                (child.spatial as ISpatial & { heights: number[] }).heights,
            );
        expect(heights.get("1/1")).toEqual([0, 0]);

        releaseRoot();
        await runtime.whenIdle();

        const finalHeights = Object.fromEntries(
            levelOne.map((child) => [
                `${child.implicit!.coordinates.x}/${child.implicit!.coordinates.y}`,
                (child.spatial as ISpatial & { heights: number[] }).heights,
            ]),
        );
        expect(finalHeights).toEqual({ "0/0": [7, 8], "1/0": [100, 150], "0/1": [200, 250], "1/1": [300, 350] });
        expect(origins).toEqual(expect.arrayContaining(["0/0:content", "1/0:parent-content", "0/1:parent-content", "1/1:parent-content"]));
        expect(origins).not.toContain("0/0:parent-content");
        await runtime.dispose();
    });

    it("releases inactive implicit branches and subtrees, then materializes them again", async () => {
        const source = createWebMapImplicitSource({
            urlTemplates: "https://dem.example.test/{z}/{x}/{y}.png",
            maximumZoom: 2,
            subtreeLevels: 1,
        });
        const denseLoader = new DenseImplicitSubtreeLoader();
        let subtreeLoads = 0;
        const contentLoads: string[] = [];
        const adapter: IRuntimeAdapter<ICamera, ISpatial, IHandle, string> = {
            tilesets: { load: async () => ({ tileset: source.tileset }) },
            subtrees: {
                load: async (request) => {
                    subtreeLoads++;
                    return denseLoader.load(request);
                },
            },
            implicitTiles: source.resolver,
            spatial: new TestSpatialMetric(),
            content: {
                load: async (context) => {
                    contentLoads.push(context.uri);
                    return {
                        kind: "renderable",
                        handle: { uri: context.uri },
                        cost: { cpuBytes: 1, gpuBytes: 1, networkBytes: 1 },
                    };
                },
                attach: () => undefined,
                detach: () => undefined,
                dispose: () => undefined,
            },
        };
        const runtime = new TileRuntime({
            id: "implicit-cache",
            uri: "memory://dem/tileset.json",
            adapter,
            maxScreenSpaceError: 1,
            cache: {
                maxMaterializedTiles: 4,
                maxSubtreeEntries: 1,
                // The deprecated frame count still applies when an application sets it.
                unusedFrameRetention: 1000,
            },
            // Immediate coarsening and no preloading: the scenario follows each frame.
            coarseningDelayMilliseconds: 0,
            preloadSiblings: false,
        });

        await runtime.update({ multiplier: 1 });
        await runtime.whenIdle();
        const initialSubtreeLoads = subtreeLoads;
        const initialLevelTwoLoads = contentLoads.filter((uri) => uri.includes("/2/")).length;
        expect(initialSubtreeLoads).toBeGreaterThan(1);
        expect(initialLevelTwoLoads).toBeGreaterThan(0);

        await runtime.update({ multiplier: 0 });
        await runtime.whenIdle();
        await runtime.trimCache(true);

        const trimmed = runtime.instrumentation.snapshot();
        expect(runtime.root?.children).toHaveLength(0);
        expect(trimmed.nodes.total).toBe(1);
        expect(trimmed.cache.subtreeEvictions).toBeGreaterThan(0);
        expect(trimmed.cache.implicitBranchPrunes).toBeGreaterThan(0);

        await runtime.update({ multiplier: 1 });
        await runtime.whenIdle();
        expect(subtreeLoads).toBeGreaterThan(initialSubtreeLoads);
        expect(contentLoads.filter((uri) => uri.includes("/2/")).length).toBeGreaterThan(initialLevelTwoLoads);
        await runtime.dispose();
    });
});
