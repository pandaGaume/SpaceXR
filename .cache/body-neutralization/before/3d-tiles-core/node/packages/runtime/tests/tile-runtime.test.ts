import type { IMetadataSchema, ITile, ITileset } from "@spacexr/3d-tiles-core";
import { describe, expect, it } from "vitest";

import type {
    ICameraEventSource,
    IContentLoadContext,
    ContentLoadResult,
    IContentPresentationContext,
    ILoadedTileset,
    IRuntimeAdapter,
    IRuntimeHooks,
    IRuntimeSubscription,
    ISpatialDerivationContext,
    ISpatialMetric,
    ITilesetLoadRequest,
} from "../src";
import { TileRuntime } from "../src";

interface IFakeCamera {
    multiplier: number;
}

interface IFakeSpatial {
    geometricError: number;
}

interface IRotationSpatial extends IFakeSpatial {
    branch: number;
}

interface IFakeHandle {
    uri: string;
}

interface IDeferred<T> {
    promise: Promise<T>;
    resolve(value: T): void;
}

function deferred<T>(): IDeferred<T> {
    let resolvePromise: ((value: T) => void) | undefined;
    const promise = new Promise<T>((resolve) => {
        resolvePromise = resolve;
    });
    return {
        promise,
        resolve: (value) => {
            if (!resolvePromise) throw new Error("Deferred resolver is unavailable.");
            resolvePromise(value);
        },
    };
}

class FakeSpatialMetric implements ISpatialMetric<IFakeCamera, IFakeSpatial> {
    public derive(context: ISpatialDerivationContext<IFakeSpatial>): IFakeSpatial {
        return { geometricError: context.tile.geometricError };
    }

    public isVisible(): boolean {
        return true;
    }

    public screenSpaceError(context: { camera: IFakeCamera; spatial: IFakeSpatial }): number {
        return context.spatial.geometricError * context.camera.multiplier;
    }
}

class RotationSpatialMetric implements ISpatialMetric<IFakeCamera, IRotationSpatial> {
    public derive(context: ISpatialDerivationContext<IRotationSpatial>): IRotationSpatial {
        return {
            geometricError: context.tile.geometricError,
            branch: context.tile.boundingVolume.sphere?.[0] ?? 0,
        };
    }

    public isVisible(spatial: IRotationSpatial, camera: IFakeCamera): boolean {
        return spatial.branch === 0 || spatial.branch === 1 || camera.multiplier < 0;
    }

    public screenSpaceError(context: { camera: IFakeCamera; spatial: IRotationSpatial }): number {
        return context.spatial.geometricError * Math.abs(context.camera.multiplier);
    }
}

class FakeCameraSource implements ICameraEventSource<IFakeCamera> {
    private listener?: (camera: IFakeCamera) => void;

    public constructor(private readonly initial: IFakeCamera) {}

    public subscribe(listener: (camera: IFakeCamera) => void): IRuntimeSubscription {
        this.listener = listener;
        return { unsubscribe: () => delete this.listener };
    }

    public current(): IFakeCamera {
        return this.initial;
    }

    public emit(camera: IFakeCamera): void {
        this.listener?.(camera);
    }
}

function tilesetLoader(tileset: ITileset): { load(request: ITilesetLoadRequest): Promise<ILoadedTileset> } {
    return {
        load: async () => ({ tileset }),
    };
}

function tile(uri: string, geometricError = 0): ITile {
    return {
        boundingVolume: { sphere: [0, 0, 0, 10] },
        geometricError,
        content: { uri },
    };
}

describe("TileRuntime", () => {
    it("applies completed loads on the next caller-driven frame", async () => {
        const loaded = deferred<ContentLoadResult<IFakeHandle>>();
        const attached: string[] = [];
        const adapter: IRuntimeAdapter<IFakeCamera, IFakeSpatial, IFakeHandle, string> = {
            tilesets: tilesetLoader({
                asset: { version: "1.1" },
                geometricError: 0,
                root: tile("root.glb"),
            }),
            spatial: new FakeSpatialMetric(),
            content: {
                load: () => loaded.promise,
                attach: (context) => {
                    attached.push(context.uri);
                },
                detach: () => undefined,
            },
        };
        const runtime = new TileRuntime({ id: "frame-driven", uri: "https://example.test/tileset.json", adapter });

        await runtime.update({ multiplier: 1 });
        expect(runtime.instrumentation.snapshot().frame).toBe(1);
        expect(runtime.pendingLoads).toBe(1);
        expect(runtime.hasPendingWork).toBe(false);
        expect(attached).toEqual([]);

        loaded.resolve({ kind: "renderable", handle: { uri: "https://example.test/root.glb" } });
        await new Promise<void>((resolve) => setTimeout(resolve, 0));

        expect(runtime.instrumentation.snapshot().frame).toBe(1);
        expect(runtime.hasPendingWork).toBe(true);
        expect(attached).toEqual([]);

        await runtime.update({ multiplier: 1 });
        expect(runtime.instrumentation.snapshot().frame).toBe(2);
        expect(runtime.hasPendingWork).toBe(false);
        expect(attached).toEqual(["https://example.test/root.glb"]);
        await runtime.dispose();
    });

    it("keeps a REPLACE parent visible until the complete child front is ready", async () => {
        const childB = deferred<ContentLoadResult<IFakeHandle>>();
        const operations: string[] = [];
        const tileset: ITileset = {
            asset: { version: "1.1" },
            geometricError: 100,
            root: {
                ...tile("root.glb", 100),
                refine: "REPLACE",
                children: [tile("child-a.glb"), tile("child-b.glb")],
            },
        };
        const adapter: IRuntimeAdapter<IFakeCamera, IFakeSpatial, IFakeHandle, string> = {
            tilesets: tilesetLoader(tileset),
            spatial: new FakeSpatialMetric(),
            content: {
                load: async (context) =>
                    context.uri.endsWith("child-b.glb") ? childB.promise : { kind: "renderable", handle: { uri: context.uri } },
                attach: (context) => {
                    operations.push(`attach:${context.uri}`);
                },
                detach: (context) => {
                    operations.push(`detach:${context.uri}`);
                },
            },
        };
        const runtime = new TileRuntime({ id: "mine", uri: "https://example.test/tileset.json", adapter, maxScreenSpaceError: 10 });

        await runtime.update({ multiplier: 1 });
        await new Promise<void>((resolve) => setTimeout(resolve, 0));
        await runtime.update({ multiplier: 1 });
        expect(runtime.selectedTiles.map((node) => node.id)).toEqual(["mine/root"]);

        childB.resolve({ kind: "renderable", handle: { uri: "https://example.test/child-b.glb" } });
        await runtime.whenIdle();

        expect(runtime.selectedTiles.map((node) => node.id).sort()).toEqual(["mine/root/0", "mine/root/1"]);
        const detachParent = operations.indexOf("detach:https://example.test/root.glb");
        const lastChildAttach = Math.max(
            operations.indexOf("attach:https://example.test/child-a.glb"),
            operations.indexOf("attach:https://example.test/child-b.glb"),
        );
        expect(detachParent).toBeGreaterThan(lastChildAttach);
        await runtime.dispose();
    });

    it("uses SSE hysteresis to prevent refine and coarsen oscillation", async () => {
        const tileset: ITileset = {
            asset: { version: "1.1" },
            geometricError: 16,
            root: {
                ...tile("root.glb", 16),
                refine: "REPLACE",
                children: [tile("child.glb")],
            },
        };
        const adapter: IRuntimeAdapter<IFakeCamera, IFakeSpatial, IFakeHandle, string> = {
            tilesets: tilesetLoader(tileset),
            spatial: new FakeSpatialMetric(),
            content: {
                load: async (context) => ({ kind: "renderable", handle: { uri: context.uri } }),
                attach: () => undefined,
                detach: () => undefined,
            },
        };
        const runtime = new TileRuntime({
            id: "hysteresis",
            uri: "https://example.test/tileset.json",
            adapter,
            maxScreenSpaceError: 10,
            refinementHysteresisRatio: 0.2,
            // Immediate coarsening and no preloading: the scenario follows each frame.
            coarseningDelayMilliseconds: 0,
            preloadSiblings: false,
        });

        await runtime.update({ multiplier: 1 });
        await runtime.whenIdle();
        expect(runtime.selectedTiles.map((node) => node.id)).toEqual(["hysteresis/root/0"]);

        await runtime.update({ multiplier: 0.6 });
        expect(runtime.selectedTiles.map((node) => node.id)).toEqual(["hysteresis/root/0"]);

        await runtime.update({ multiplier: 0.49 });
        expect(runtime.selectedTiles.map((node) => node.id)).toEqual(["hysteresis/root"]);
        expect(runtime.instrumentation.snapshot().metrics["tile.refine"]?.count).toBe(1);
        expect(runtime.instrumentation.snapshot().metrics["tile.coarsen"]?.count).toBe(1);
        await runtime.dispose();
    });

    it("holds back new refinements only, with its threshold scale", async () => {
        const tileset: ITileset = {
            asset: { version: "1.1" },
            geometricError: 16,
            root: {
                ...tile("root.glb", 16),
                refine: "REPLACE",
                children: [tile("child.glb")],
            },
        };
        const adapter: IRuntimeAdapter<IFakeCamera, IFakeSpatial, IFakeHandle, string> = {
            tilesets: tilesetLoader(tileset),
            spatial: new FakeSpatialMetric(),
            content: {
                load: async (context) => ({ kind: "renderable", handle: { uri: context.uri } }),
                attach: () => undefined,
                detach: () => undefined,
            },
        };
        let scale = 4;
        const runtime = new TileRuntime({
            id: "scale",
            uri: "https://example.test/tileset.json",
            adapter,
            maxScreenSpaceError: 10,
            refinementHysteresisRatio: 0.2,
            refinementThresholdScale: () => scale,
            coarseningDelayMilliseconds: 0,
            preloadSiblings: false,
        });

        // An error of 16 is above the threshold of 10, and below 40.
        await runtime.update({ multiplier: 1 });
        await runtime.whenIdle();
        expect(runtime.selectedTiles.map((node) => node.id)).toEqual(["scale/root"]);

        scale = 1;
        await runtime.update({ multiplier: 1 });
        await runtime.whenIdle();
        expect(runtime.selectedTiles.map((node) => node.id)).toEqual(["scale/root/0"]);

        // A refined tile does not coarsen because the scale rises: only under 8, the threshold minus its hysteresis.
        scale = 4;
        await runtime.update({ multiplier: 0.6 });
        expect(runtime.selectedTiles.map((node) => node.id)).toEqual(["scale/root/0"]);
        await runtime.update({ multiplier: 0.49 });
        expect(runtime.selectedTiles.map((node) => node.id)).toEqual(["scale/root"]);
        await runtime.dispose();
    });

    it("keeps children presented until an evicted parent is ready during zoom out", async () => {
        const parentReload = deferred<ContentLoadResult<IFakeHandle>>();
        const operations: string[] = [];
        let parentLoads = 0;
        const tileset: ITileset = {
            asset: { version: "1.1" },
            geometricError: 100,
            root: {
                ...tile("root.glb", 100),
                refine: "REPLACE",
                children: [tile("child.glb")],
            },
        };
        const adapter: IRuntimeAdapter<IFakeCamera, IFakeSpatial, IFakeHandle, string> = {
            tilesets: tilesetLoader(tileset),
            spatial: new FakeSpatialMetric(),
            content: {
                load: async (context) => {
                    if (context.uri.endsWith("root.glb")) {
                        parentLoads++;
                        if (parentLoads > 1) return parentReload.promise;
                    }
                    return { kind: "renderable", handle: { uri: context.uri } };
                },
                attach: (context) => {
                    operations.push(`attach:${context.uri}`);
                },
                detach: (context) => {
                    operations.push(`detach:${context.uri}`);
                },
                dispose: () => undefined,
            },
        };
        const runtime = new TileRuntime({
            id: "zoom-out",
            uri: "https://example.test/tileset.json",
            adapter,
            maxScreenSpaceError: 10,
            cache: { maxContentEntries: 1, unusedRetentionMilliseconds: 60_000 },
            // Immediate coarsening and no preloading: the scenario follows each frame.
            coarseningDelayMilliseconds: 0,
            preloadSiblings: false,
        });

        await runtime.update({ multiplier: 0 });
        await runtime.whenIdle();
        await runtime.update({ multiplier: 1 });
        await runtime.whenIdle();
        expect(runtime.selectedTiles.map((node) => node.id)).toEqual(["zoom-out/root/0"]);
        expect(parentLoads).toBe(1);

        operations.length = 0;
        await runtime.update({ multiplier: 0 });
        expect(parentLoads).toBe(2);
        expect(runtime.selectedTiles.map((node) => node.id)).toEqual(["zoom-out/root/0"]);
        expect(operations).not.toContain("detach:https://example.test/child.glb");

        parentReload.resolve({ kind: "renderable", handle: { uri: "https://example.test/root.glb" } });
        await runtime.whenIdle();
        expect(runtime.selectedTiles.map((node) => node.id)).toEqual(["zoom-out/root"]);
        expect(operations.indexOf("attach:https://example.test/root.glb")).toBeLessThan(
            operations.indexOf("detach:https://example.test/child.glb"),
        );
        await runtime.dispose();
    });

    it("grows an adaptive budget to what the view selects, and keeps a fixed one by default", async () => {
        const evictions = async (workingSetFactor?: number): Promise<number> => {
            const tileset: ITileset = {
                asset: { version: "1.1" },
                geometricError: 100,
                root: {
                    ...tile("root.glb", 100),
                    refine: "REPLACE",
                    children: [tile("a.glb"), tile("b.glb"), tile("c.glb"), tile("d.glb")],
                },
            };
            const runtime = new TileRuntime({
                id: "adaptive",
                uri: "https://example.test/tileset.json",
                adapter: {
                    tilesets: tilesetLoader(tileset),
                    spatial: new FakeSpatialMetric(),
                    content: {
                        load: async (context) => ({ kind: "renderable", handle: { uri: context.uri } }),
                        attach: () => undefined,
                        detach: () => undefined,
                        dispose: () => undefined,
                    },
                } as IRuntimeAdapter<IFakeCamera, IFakeSpatial, IFakeHandle, string>,
                maxScreenSpaceError: 10,
                cache: {
                    maxContentEntries: 1,
                    unusedRetentionMilliseconds: 60_000,
                    ...(workingSetFactor === undefined ? {} : { workingSetFactor }),
                },
                coarseningDelayMilliseconds: 0,
                preloadSiblings: false,
            });
            let evicted = 0;
            runtime.events.subscribe((event) => {
                if (event.type === "cache-eviction" && event.eviction.reason === "entry-budget") evicted++;
            });
            await runtime.update({ multiplier: 1 });
            await runtime.whenIdle();
            await runtime.update({ multiplier: 1 });
            await runtime.whenIdle();
            await runtime.dispose();
            return evicted;
        };
        // Four selected tiles and their parent: 5 entries over a budget of 1.
        expect(await evictions()).toBeGreaterThan(0);
        expect(await evictions(2)).toBe(0);
    });

    it("uses a ready ancestor as complete coverage while a camera rotation reveals a loading branch", async () => {
        const loads: string[] = [];
        const operations: string[] = [];
        const childBLoad = deferred<ContentLoadResult<IFakeHandle>>();
        const childA = { ...tile("child-a.glb"), boundingVolume: { sphere: [1, 0, 0, 10] as [number, number, number, number] } };
        const childB = { ...tile("child-b.glb"), boundingVolume: { sphere: [-1, 0, 0, 10] as [number, number, number, number] } };
        const tileset: ITileset = {
            asset: { version: "1.1" },
            geometricError: 100,
            root: {
                ...tile("root.glb", 100),
                refine: "REPLACE",
                children: [childA, childB],
            },
        };
        const adapter: IRuntimeAdapter<IFakeCamera, IRotationSpatial, IFakeHandle, string> = {
            tilesets: tilesetLoader(tileset),
            spatial: new RotationSpatialMetric(),
            content: {
                load: async (context) => {
                    loads.push(context.uri);
                    if (context.uri.endsWith("child-b.glb")) return childBLoad.promise;
                    return { kind: "renderable", handle: { uri: context.uri } };
                },
                attach: (context) => {
                    operations.push(`attach:${context.uri}`);
                },
                detach: (context) => {
                    operations.push(`detach:${context.uri}`);
                },
            },
        };
        const runtime = new TileRuntime({
            id: "rotation",
            uri: "https://example.test/tileset.json",
            adapter,
            maxScreenSpaceError: 10,
            // Immediate coarsening and no preloading: the scenario follows each frame.
            coarseningDelayMilliseconds: 0,
            preloadSiblings: false,
        });

        await runtime.update({ multiplier: 1 });
        await runtime.whenIdle();
        expect(loads).toContain("https://example.test/child-a.glb");
        expect(loads).not.toContain("https://example.test/child-b.glb");
        expect(runtime.selectedTiles.map((node) => node.id)).toEqual(["rotation/root/0"]);

        operations.length = 0;
        await runtime.update({ multiplier: -1 });
        expect(loads).toContain("https://example.test/child-b.glb");
        expect(runtime.selectedTiles.map((node) => node.id)).toEqual(["rotation/root"]);
        expect(operations).toContain("attach:https://example.test/root.glb");

        childBLoad.resolve({ kind: "renderable", handle: { uri: "https://example.test/child-b.glb" } });
        await runtime.whenIdle();
        expect(runtime.selectedTiles.map((node) => node.id).sort()).toEqual(["rotation/root/0", "rotation/root/1"]);
        await runtime.dispose();
    });

    it("grafts extensionless external tilesets without classifying by file extension", async () => {
        const loadedUris: string[] = [];
        const external: ITileset = {
            asset: { version: "1.1" },
            geometricError: 0,
            root: { ...tile("mesh-resource"), refine: "REPLACE" },
        };
        const root: ITileset = {
            asset: { version: "1.1" },
            geometricError: 0,
            root: { ...tile("nested-resource"), refine: "REPLACE" },
        };
        const adapter: IRuntimeAdapter<IFakeCamera, IFakeSpatial, IFakeHandle, string> = {
            tilesets: tilesetLoader(root),
            spatial: new FakeSpatialMetric(),
            content: {
                load: async (context) => {
                    loadedUris.push(context.uri);
                    return context.uri.endsWith("nested-resource")
                        ? { kind: "external-tileset", tileset: external }
                        : { kind: "renderable", handle: { uri: context.uri } };
                },
                attach: () => undefined,
                detach: () => undefined,
            },
        };
        const runtime = new TileRuntime({ id: "external", uri: "https://example.test/tileset.json", adapter });

        await runtime.update({ multiplier: 1 });
        await runtime.whenIdle();

        expect(loadedUris).toEqual(expect.arrayContaining(["https://example.test/nested-resource", "https://example.test/mesh-resource"]));
        expect(runtime.root?.children).toHaveLength(1);
        expect(runtime.selectedTiles.map((node) => node.id)).toEqual(["external/root/external-0"]);
        await runtime.dispose();
    });

    it("receives camera events and exposes metadata to content, glyph and hook adapters", async () => {
        const schema: IMetadataSchema = {
            id: "Mining",
            classes: {
                Anchor: {
                    properties: {
                        label: { type: "STRING", required: true, semantic: "LABEL" },
                    },
                },
            },
        };
        const tileset: ITileset = {
            asset: { version: "1.1" },
            geometricError: 0,
            schema,
            metadata: { class: "Anchor", properties: { label: "Mine" } },
            groups: [{ class: "Anchor", properties: { label: "Investor" } }],
            root: {
                boundingVolume: { sphere: [0, 0, 0, 1] },
                geometricError: 0,
                refine: "REPLACE",
                metadata: { class: "Anchor", properties: { label: "Expansion" } },
                content: {
                    uri: "anchor.glb",
                    group: 0,
                    metadata: { class: "Anchor", properties: { label: "Arrow" } },
                },
            },
        };
        const snapshots: IContentPresentationContext<IFakeSpatial, IFakeHandle>[] = [];
        const glyphScopes: string[][] = [];
        const hooksCalled: string[] = [];
        const camera = new FakeCameraSource({ multiplier: 1 });
        const hooks: IRuntimeHooks<IFakeCamera, IFakeSpatial, IFakeHandle, string> = {
            beforeMetadataResolve: () => {
                hooksCalled.push("before-metadata");
            },
            afterMetadataResolve: () => {
                hooksCalled.push("after-metadata");
            },
            beforeGlyphPublish: () => {
                hooksCalled.push("before-glyph");
            },
            afterGlyphPublish: () => {
                hooksCalled.push("after-glyph");
            },
        };
        const adapter: IRuntimeAdapter<IFakeCamera, IFakeSpatial, IFakeHandle, string> = {
            tilesets: tilesetLoader(tileset),
            camera,
            spatial: new FakeSpatialMetric(),
            content: {
                load: async (context: IContentLoadContext<IFakeSpatial>) => ({
                    kind: "renderable",
                    handle: { uri: context.uri },
                    featureMetadata: [{ id: "feature-1", entity: { class: "Anchor", properties: { label: "Future pit" } } }],
                }),
                attach: (context) => {
                    snapshots.push(context);
                },
                detach: () => undefined,
            },
            glyphs: {
                publish: (context) => {
                    glyphScopes.push(context.metadata.flatMap((snapshot) => snapshot.scopes.map((scope) => scope.scope)));
                    return [context.tileId];
                },
                revoke: () => undefined,
            },
        };
        const runtime = new TileRuntime({ id: "metadata", uri: "https://example.test/tileset.json", adapter, hooks: [hooks] });

        await runtime.start();
        await new Promise<void>((resolve) => queueMicrotask(resolve));
        await runtime.whenIdle();

        expect(snapshots).toHaveLength(1);
        expect(snapshots[0]?.metadata.scopes.map((scope) => scope.scope)).toEqual(["tileset", "tile", "group", "content", "feature"]);
        expect(glyphScopes.at(-1)).toEqual(["tileset", "tile", "group", "content", "feature"]);
        expect(hooksCalled).toEqual(expect.arrayContaining(["before-metadata", "after-metadata", "before-glyph", "after-glyph"]));

        camera.emit({ multiplier: 2 });
        await runtime.whenIdle();
        expect(runtime.selectedTiles).toHaveLength(1);
        await runtime.dispose();
    });

    it("loads an external metadata schema through the dedicated port", async () => {
        const schema: IMetadataSchema = { id: "External", classes: { Site: { properties: { name: { type: "STRING" } } } } };
        const tileset: ITileset = {
            asset: { version: "1.1" },
            geometricError: 0,
            schemaUri: "schemas/mining.json",
            metadata: { class: "Site", properties: { name: "Blue Mine" } },
            root: { boundingVolume: { sphere: [0, 0, 0, 1] }, geometricError: 0, refine: "REPLACE" },
        };
        const schemaRequests: string[] = [];
        const adapter: IRuntimeAdapter<IFakeCamera, IFakeSpatial, IFakeHandle, string> = {
            tilesets: tilesetLoader(tileset),
            spatial: new FakeSpatialMetric(),
            metadataSchemas: {
                load: async (request) => {
                    schemaRequests.push(request.uri);
                    return schema;
                },
            },
            content: {
                load: async (): Promise<ContentLoadResult<IFakeHandle>> => ({ kind: "empty" }),
                attach: () => undefined,
                detach: () => undefined,
            },
        };
        const runtime = new TileRuntime({ id: "schema", uri: "https://example.test/models/tileset.json", adapter });

        await runtime.start();

        expect(schemaRequests).toEqual(["https://example.test/models/schemas/mining.json"]);
        expect(runtime.document?.metadata.schema?.id).toBe("External");
        await runtime.dispose();
    });

    it("evicts detached renderables by budget, reloads them on return and exposes live statistics", async () => {
        const loads: string[] = [];
        const disposals: string[] = [];
        const externalMetrics: string[] = [];
        const tileset: ITileset = {
            asset: { version: "1.1" },
            geometricError: 100,
            root: {
                ...tile("root.glb", 100),
                refine: "REPLACE",
                children: [tile("child-a.glb"), tile("child-b.glb")],
            },
        };
        const adapter: IRuntimeAdapter<IFakeCamera, IFakeSpatial, IFakeHandle, string> = {
            tilesets: tilesetLoader(tileset),
            spatial: new FakeSpatialMetric(),
            content: {
                load: async (context) => {
                    loads.push(context.uri);
                    return {
                        kind: "renderable",
                        handle: { uri: context.uri },
                        cacheKey: context.uri,
                        cost: { cpuBytes: 10, gpuBytes: 20, networkBytes: 30 },
                    };
                },
                attach: () => undefined,
                detach: () => undefined,
                dispose: (context) => {
                    disposals.push(context.uri);
                },
            },
            telemetry: {
                record: (metric) => {
                    externalMetrics.push(metric.name);
                },
            },
        };
        const runtime = new TileRuntime({
            id: "cache",
            uri: "https://example.test/tileset.json",
            adapter,
            maxScreenSpaceError: 10,
            cache: { maxContentEntries: 2, unusedRetentionMilliseconds: 60_000 },
            // Immediate coarsening and no preloading: the scenario follows each frame.
            coarseningDelayMilliseconds: 0,
            preloadSiblings: false,
        });
        const publications: number[] = [];
        runtime.instrumentation.subscribe((snapshot) => publications.push(snapshot.frame));

        await runtime.update({ multiplier: 0 });
        await runtime.whenIdle();
        await runtime.update({ multiplier: 1 });
        await runtime.whenIdle();

        expect(disposals).toContain("https://example.test/root.glb");
        expect(runtime.instrumentation.snapshot().cache.contentEvictions).toBeGreaterThanOrEqual(1);
        expect(runtime.instrumentation.snapshot().contents.cached).toBeLessThanOrEqual(2);
        expect(runtime.instrumentation.snapshot().metrics["content.load.network-bytes"]?.sum).toBe(90);

        await runtime.update({ multiplier: 0 });
        await runtime.whenIdle();
        expect(loads.filter((uri) => uri.endsWith("root.glb"))).toHaveLength(2);

        const metricsBeforeDisable = runtime.instrumentation.snapshot().metrics.frame?.count;
        const publicationsBeforeDisable = publications.length;
        const externalMetricsBeforeDisable = externalMetrics.length;
        runtime.instrumentation.setEnabled(false);
        await runtime.update({ multiplier: 0 });
        expect(runtime.instrumentation.snapshot().metrics.frame?.count).toBe(metricsBeforeDisable);
        expect(publications).toHaveLength(publicationsBeforeDisable);
        expect(externalMetrics).toHaveLength(externalMetricsBeforeDisable);

        runtime.instrumentation.setEnabled(true);
        await runtime.update({ multiplier: 0 });
        expect(runtime.instrumentation.snapshot().metrics.frame?.count).toBe((metricsBeforeDisable ?? 0) + 1);
        expect(publications.length).toBeGreaterThan(publicationsBeforeDisable);
        await runtime.dispose();
    });
});

describe("TileRuntime navigation defaults", () => {
    /** Root refined into two children: child A in the view, child B outside it until the camera turns (multiplier -1). */
    function rotationScenario() {
        const loads: string[] = [];
        const childA = { ...tile("child-a.glb"), boundingVolume: { sphere: [1, 0, 0, 10] as [number, number, number, number] } };
        const childB = { ...tile("child-b.glb"), boundingVolume: { sphere: [-1, 0, 0, 10] as [number, number, number, number] } };
        const tileset: ITileset = {
            asset: { version: "1.1" },
            geometricError: 100,
            root: { ...tile("root.glb", 100), refine: "REPLACE", children: [childA, childB] },
        };
        const adapter: IRuntimeAdapter<IFakeCamera, IRotationSpatial, IFakeHandle, string> = {
            tilesets: tilesetLoader(tileset),
            spatial: new RotationSpatialMetric(),
            content: {
                load: async (context) => {
                    loads.push(context.uri);
                    return { kind: "renderable", handle: { uri: context.uri } };
                },
                attach: () => undefined,
                detach: () => undefined,
            },
        };
        return { loads, adapter };
    }

    it("preloads the children outside the view by default, so that turning the camera keeps the refinement", async () => {
        const { loads, adapter } = rotationScenario();
        const runtime = new TileRuntime({ id: "defaults", uri: "https://example.test/tileset.json", adapter, maxScreenSpaceError: 10 });

        await runtime.update({ multiplier: 1 });
        await runtime.whenIdle();
        expect(loads).toContain("https://example.test/child-b.glb");

        await runtime.update({ multiplier: -1 });
        expect(runtime.selectedTiles.map((node) => node.id).sort()).toEqual(["defaults/root/0", "defaults/root/1"]);
        await runtime.dispose();
    });

    it("loads only the children in the view when preloading is turned off", async () => {
        const { loads, adapter } = rotationScenario();
        const runtime = new TileRuntime({
            id: "off",
            uri: "https://example.test/tileset.json",
            adapter,
            maxScreenSpaceError: 10,
            preloadSiblings: false,
        });

        await runtime.update({ multiplier: 1 });
        await runtime.whenIdle();
        expect(loads).not.toContain("https://example.test/child-b.glb");
        await runtime.dispose();
    });

    it("keeps a refinement for 300 milliseconds by default after nothing requires it", async () => {
        const { adapter } = rotationScenario();
        let now = 0;
        const runtime = new TileRuntime({
            clock: () => now,
            id: "delay",
            uri: "https://example.test/tileset.json",
            adapter,
            maxScreenSpaceError: 10,
        });

        await runtime.update({ multiplier: 1 });
        await runtime.whenIdle();
        // The screen-space error no longer requires the refinement.
        await runtime.update({ multiplier: 0 });
        now = 299;
        await runtime.update({ multiplier: 0 });
        expect(runtime.selectedTiles.map((node) => node.id)).not.toContain("delay/root");
        now = 300;
        await runtime.update({ multiplier: 0 });
        expect(runtime.selectedTiles.map((node) => node.id)).toEqual(["delay/root"]);
        await runtime.dispose();
    });
});

describe("TileRuntime cache retention", () => {
    /** Root refined into one child; the root content is detached and cached while the child is shown. */
    function retentionScenario(cache: NonNullable<ConstructorParameters<typeof TileRuntime>[0]["cache"]>, clock: () => number) {
        const disposals: string[] = [];
        const tileset: ITileset = {
            asset: { version: "1.1" },
            geometricError: 100,
            root: { ...tile("root.glb", 100), refine: "REPLACE", children: [tile("child.glb")] },
        };
        const adapter: IRuntimeAdapter<IFakeCamera, IFakeSpatial, IFakeHandle, string> = {
            tilesets: tilesetLoader(tileset),
            spatial: new FakeSpatialMetric(),
            content: {
                load: async (context) => ({ kind: "renderable", handle: { uri: context.uri }, cacheKey: context.uri }),
                attach: () => undefined,
                detach: () => undefined,
                dispose: (context) => {
                    disposals.push(context.uri);
                },
            },
        };
        const runtime = new TileRuntime({
            id: "retention",
            uri: "https://example.test/tileset.json",
            adapter,
            maxScreenSpaceError: 10,
            cache,
            clock,
            coarseningDelayMilliseconds: 0,
        });
        return { runtime, disposals };
    }

    it("keeps an inactive content for the retention time, however many frames run", async () => {
        let now = 0;
        const { runtime, disposals } = retentionScenario({ unusedRetentionMilliseconds: 60_000 }, () => now);
        await runtime.update({ multiplier: 0 });
        await runtime.whenIdle();
        await runtime.update({ multiplier: 1 });
        await runtime.whenIdle();

        // 500 frames within 50 seconds: the root stays cached.
        for (let frame = 0; frame < 500; frame++) {
            now += 100;
            await runtime.update({ multiplier: 1 });
        }
        expect(disposals).not.toContain("https://example.test/root.glb");

        // Past the retention time, the next frame evicts it.
        now += 20_000;
        await runtime.update({ multiplier: 1 });
        expect(disposals).toContain("https://example.test/root.glb");
        await runtime.dispose();
    });

    it("still applies a deprecated frame count when an application sets one", async () => {
        const { runtime, disposals } = retentionScenario({ unusedFrameRetention: 3 }, () => 0);
        await runtime.update({ multiplier: 0 });
        await runtime.whenIdle();
        await runtime.update({ multiplier: 1 });
        await runtime.whenIdle();

        for (let frame = 0; frame < 5; frame++) await runtime.update({ multiplier: 1 });
        expect(disposals).toContain("https://example.test/root.glb");
        await runtime.dispose();
    });
});

describe("TileRuntime zoom out", () => {
    interface IZoomCamera {
        multiplier: number;
        /** Hides the western branch, as a narrower view would. */
        narrow: boolean;
    }

    interface IZoomSpatial {
        geometricError: number;
        west: boolean;
    }

    class ZoomSpatialMetric implements ISpatialMetric<IZoomCamera, IZoomSpatial> {
        public derive(context: ISpatialDerivationContext<IZoomSpatial>): IZoomSpatial {
            const west = (context.tile.boundingVolume.sphere?.[0] ?? 0) < 0 || context.parent?.west === true;
            return { geometricError: context.tile.geometricError, west };
        }

        public isVisible(spatial: IZoomSpatial, camera: IZoomCamera): boolean {
            return !(camera.narrow && spatial.west);
        }

        public screenSpaceError(context: { camera: IZoomCamera; spatial: IZoomSpatial }): number {
            return context.spatial.geometricError * context.camera.multiplier;
        }
    }

    /**
     * root > a > [east, west], each with one finer child. Zoomed in on the east branch with a narrow view, then zoomed
     * out: the view widens to the west branch and the wanted level is that of east and west.
     */
    function zoomOutScenario(preloadSiblings: boolean) {
        const westLoad = deferred<ContentLoadResult<IFakeHandle>>();
        const sphere = (x: number) => ({ sphere: [x, 0, 0, 10] as [number, number, number, number] });
        const east = {
            ...tile("east.glb", 10),
            boundingVolume: sphere(1),
            refine: "REPLACE" as const,
            children: [{ ...tile("east-child.glb", 1), boundingVolume: sphere(1) }] as [ITile],
        };
        const west = {
            ...tile("west.glb", 10),
            boundingVolume: sphere(-1),
            refine: "REPLACE" as const,
            children: [{ ...tile("west-child.glb", 1), boundingVolume: sphere(-1) }] as [ITile],
        };
        const tileset: ITileset = {
            asset: { version: "1.1" },
            geometricError: 1000,
            root: {
                ...tile("root.glb", 1000),
                refine: "REPLACE",
                children: [{ ...tile("a.glb", 100), refine: "REPLACE", children: [east, west] }],
            },
        };
        const adapter: IRuntimeAdapter<IZoomCamera, IZoomSpatial, IFakeHandle, string> = {
            tilesets: tilesetLoader(tileset),
            spatial: new ZoomSpatialMetric(),
            content: {
                load: async (context) => {
                    // Without preloading, the west tile only loads once the view widens, and waits on `westLoad`.
                    if (!preloadSiblings && context.uri.endsWith("/west.glb")) return westLoad.promise;
                    return { kind: "renderable", handle: { uri: context.uri } };
                },
                attach: () => undefined,
                detach: () => undefined,
            },
        };
        const runtime = new TileRuntime({
            id: "zoom",
            uri: "https://example.test/tileset.json",
            adapter,
            maxScreenSpaceError: 10,
            preloadSiblings,
            coarseningDelayMilliseconds: 0,
        });
        return { runtime, westLoad };
    }

    async function zoomInThenOut(runtime: TileRuntime<IZoomCamera, IZoomSpatial, IFakeHandle, string>): Promise<void> {
        // Zoomed in with a narrow view: root 2000, a 200 and east 20 refine down to the east child.
        for (let frame = 0; frame < 6; frame++) {
            await runtime.update({ multiplier: 2, narrow: true });
            await runtime.whenIdle();
        }
        expect(runtime.selectedTiles.map((node) => node.id)).toEqual(["zoom/root/0/0/0"]);
        // Zoomed out with a wide view: a 50 refines, east and west 5 are the wanted level.
        await runtime.update({ multiplier: 0.5, narrow: false });
    }

    it("shows the wanted level at once when the children entering the view were preloaded", async () => {
        const { runtime } = zoomOutScenario(true);
        await zoomInThenOut(runtime);

        expect(runtime.selectedTiles.map((node) => node.id).sort()).toEqual(["zoom/root/0/0", "zoom/root/0/1"]);
        await runtime.dispose();
    });

    it("falls back to the ready ancestor, dropping the finer tiles, when a child entering the view was not preloaded", async () => {
        const { runtime, westLoad } = zoomOutScenario(false);
        await zoomInThenOut(runtime);

        // The west tile was never loaded: a, coarser than the wanted level, covers the view while it loads.
        expect(runtime.selectedTiles.map((node) => node.id)).toEqual(["zoom/root/0"]);

        westLoad.resolve({ kind: "renderable", handle: { uri: "https://example.test/west.glb" } });
        await runtime.whenIdle();
        await runtime.update({ multiplier: 0.5, narrow: false });
        expect(runtime.selectedTiles.map((node) => node.id).sort()).toEqual(["zoom/root/0/0", "zoom/root/0/1"]);
        await runtime.dispose();
    });
});
