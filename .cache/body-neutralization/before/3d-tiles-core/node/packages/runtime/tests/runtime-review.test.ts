import type { ITileset } from "@spacexr/3d-tiles-core";
import { describe, expect, it } from "vitest";

import {
    CameraChangeFlags,
    DenseImplicitSubtreeLoader,
    TileReadinessState,
    TileRuntime,
    createWebMapImplicitSource,
    type IRuntimeAdapter,
    type ISpatialDerivationContext,
    type ITileActivationContext,
} from "../src";

interface ICamera {
    hidden?: readonly string[];
    errors?: Readonly<Record<string, number>>;
    multiplier?: number;
}

interface ISpatial {
    name: string;
    error: number;
}

const child = (name: string) => ({ boundingVolume: { sphere: [0, 0, 0, 1] }, geometricError: 0, content: { uri: `grid://${name}` } });

const tileset = (...names: string[]): ITileset =>
    ({
        asset: { version: "1.1" },
        geometricError: 100,
        root: { boundingVolume: { sphere: [0, 0, 0, 2] }, geometricError: 100, refine: "REPLACE", children: names.map(child) },
    }) as unknown as ITileset;

type Activate = (context: ITileActivationContext<ISpatial, { id: string }, never>) => Promise<void>;

const ready: Activate = async (context) => {
    for (const content of context.pendingContents)
        await context.readiness.ready(content.id, { kind: "renderable", handle: { id: content.id } });
};

function createRuntime(names: string[], activate: Activate, maxConcurrentLoads: number) {
    const adapter: IRuntimeAdapter<ICamera, ISpatial, { id: string }, never> = {
        tilesets: { load: async () => ({ tileset: tileset(...names) }) },
        spatial: {
            derive: (context: ISpatialDerivationContext<ISpatial>) => ({
                name: context.tile.content?.uri ?? "root",
                error: context.tile.geometricError,
            }),
            isVisible: (spatial, camera) => !camera.hidden?.includes(spatial.name),
            screenSpaceError: ({ spatial, camera }) => camera.errors?.[spatial.name] ?? spatial.error,
        },
        activation: { activate, deactivate: () => undefined },
        presentation: { present: () => undefined, hide: () => undefined, release: () => undefined },
    };
    return new TileRuntime({
        id: "review",
        uri: "memory://tileset.json",
        adapter,
        maxScreenSpaceError: 1,
        maxConcurrentLoads,
        preloadSiblings: false,
        coarseningDelayMilliseconds: 0,
    });
}

const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

async function frame(runtime: TileRuntime<ICamera, ISpatial, { id: string }, never>, camera: ICamera): Promise<void> {
    runtime.onCameraChanged(camera, CameraChangeFlags.All);
    await runtime.processFrame();
    await tick();
}

function contentOf(runtime: TileRuntime<ICamera, ISpatial, { id: string }, never>, uri: string) {
    for (const node of runtime.root?.children ?? []) for (const content of node.contents) if (content.uri === uri) return content;
    return undefined;
}

describe("TileRuntime activations that do not follow their signal", () => {
    it("loads a tile back once it returns, without any camera motion after that", async () => {
        const never = new Promise<void>(() => undefined);
        let attempts = 0;
        const runtime = createRuntime(
            ["a", "b"],
            async (context) => {
                if (context.pendingContents[0]?.uri === "grid://b" && attempts++ === 0) await never;
                await ready(context);
            },
            4,
        );

        await frame(runtime, {});
        await frame(runtime, { hidden: ["grid://b"] });
        expect(contentOf(runtime, "grid://b")?.status).toBe(TileReadinessState.Cancelled);

        await frame(runtime, {});
        await tick();
        expect(contentOf(runtime, "grid://b")?.status).toBe(TileReadinessState.Ready);
        await runtime.dispose();
    });

    it("gives its load slot back at once, and ignores what it reports later", async () => {
        const reports: Array<() => Promise<void>> = [];
        const started: string[] = [];
        const runtime = createRuntime(
            ["a", "b"],
            async (context) => {
                const uri = context.pendingContents[0]?.uri ?? "";
                started.push(uri);
                if (uri === "grid://a" && started.filter((name) => name === uri).length === 1) {
                    await new Promise<void>((resolve) =>
                        reports.push(async () => {
                            await context.readiness.cancelled(context.pendingContents[0]!.id);
                            resolve();
                        }),
                    );
                    return;
                }
                await ready(context);
            },
            1,
        );

        await frame(runtime, {});
        expect(started).toEqual(["grid://a"]);

        await frame(runtime, { hidden: ["grid://a"] });
        expect(started).toEqual(["grid://a", "grid://b"]);

        // A comes back and loads, then its first activation reports its cancellation, too late.
        await frame(runtime, {});
        await tick();
        expect(contentOf(runtime, "grid://a")?.status).toBe(TileReadinessState.Ready);
        await reports[0]!();
        expect(contentOf(runtime, "grid://a")?.status).toBe(TileReadinessState.Ready);
        await runtime.dispose();
    });
});

describe("TileRuntime queued priorities", () => {
    async function startOrder(first: Readonly<Record<string, number>>, second: Readonly<Record<string, number>>): Promise<string[]> {
        let release: () => void = () => undefined;
        const gate = new Promise<void>((resolve) => (release = resolve));
        const started: string[] = [];
        const runtime = createRuntime(
            ["a", "b", "c"],
            async (context) => {
                const uri = context.pendingContents[0]?.uri ?? "";
                started.push(uri);
                if (uri === "grid://a") await gate;
                await ready(context);
            },
            1,
        );
        await frame(runtime, { errors: { "grid://a": 100, ...first } });
        await frame(runtime, { errors: { "grid://a": 100, ...second } });
        release();
        await runtime.whenIdle();
        await runtime.dispose();
        return started;
    }

    it("raises the priority of a queued tile", async () => {
        expect(await startOrder({ "grid://b": 1, "grid://c": 2 }, { "grid://b": 1000, "grid://c": 2 })).toEqual([
            "grid://a",
            "grid://b",
            "grid://c",
        ]);
    });

    it("lowers the priority of a queued tile", async () => {
        expect(await startOrder({ "grid://b": 1000, "grid://c": 2 }, { "grid://b": 1, "grid://c": 2 })).toEqual([
            "grid://a",
            "grid://c",
            "grid://b",
        ]);
    });
});

describe("TileRuntime implicit materialization", () => {
    function createImplicit(maxMaterializedTiles: number, satisfiedDepth = 3) {
        const source = createWebMapImplicitSource({ urlTemplates: "grid://{z}/{x}/{y}", maximumZoom: 8, subtreeLevels: 4 });
        const adapter: IRuntimeAdapter<ICamera, object, string, never> = {
            tilesets: { load: async () => ({ tileset: source.tileset }) },
            subtrees: new DenseImplicitSubtreeLoader(),
            implicitTiles: source.resolver,
            spatial: {
                derive: () => ({}),
                isVisible: () => true,
                screenSpaceError: ({ depth }) => (depth < satisfiedDepth ? 100 : 0),
            },
            content: {
                load: async (context) => ({ kind: "renderable", handle: context.uri }),
                attach: () => undefined,
                detach: () => undefined,
            },
        };
        const runtime = new TileRuntime({
            id: "implicit",
            uri: "memory://implicit/tileset.json",
            adapter,
            maxScreenSpaceError: 1,
            preloadSiblings: false,
            coarseningDelayMilliseconds: 0,
            cache: { maxMaterializedTiles },
        });
        const nodes = (runtime as unknown as { nodes: Map<string, { depth: number; selected: boolean }> }).nodes;
        return { runtime, nodes };
    }

    it("creates no descendant below a tile that satisfies its threshold", async () => {
        const { runtime, nodes } = createImplicit(4096);
        for (let i = 0; i < 4; i++) {
            await runtime.update({});
            await runtime.whenIdle();
        }
        const selectedDepth = Math.max(...[...nodes.values()].filter((node) => node.selected).map((node) => node.depth));
        expect(Math.max(...[...nodes.values()].map((node) => node.depth))).toBe(selectedDepth);
        await runtime.dispose();
    });

    it("keeps its tile count with 1 024 leaves under a budget of 4 096, which one more level would overflow", async () => {
        const { runtime, nodes } = createImplicit(4096, 5);
        const counts: number[] = [];
        for (let i = 0; i < 8; i++) {
            await runtime.update({});
            await runtime.whenIdle();
            counts.push(nodes.size);
        }
        expect(runtime.selectedTiles).toHaveLength(1024);
        expect(new Set(counts.slice(3)).size).toBe(1);
        await runtime.dispose();
    });

    it("keeps its tile count on a fixed cut, under a budget it would overflow with one more level", async () => {
        const { runtime, nodes } = createImplicit(90);
        const counts: number[] = [];
        for (let i = 0; i < 10; i++) {
            await runtime.update({});
            await runtime.whenIdle();
            counts.push(nodes.size);
        }
        expect(new Set(counts.slice(4)).size).toBe(1);
        await runtime.dispose();
    });
});

describe("TileRuntime coarsening delay", () => {
    function createDelayed() {
        let now = 0;
        const hierarchy = {
            asset: { version: "1.1" },
            geometricError: 16,
            root: {
                boundingVolume: { sphere: [0, 0, 0, 2] },
                geometricError: 16,
                refine: "REPLACE",
                content: { uri: "grid://root" },
                children: [child("child")],
            },
        } as unknown as ITileset;
        const adapter: IRuntimeAdapter<ICamera, ISpatial, string, never> = {
            tilesets: { load: async () => ({ tileset: hierarchy }) },
            spatial: {
                derive: (context) => ({ name: context.tile.content?.uri ?? "", error: context.tile.geometricError }),
                isVisible: () => true,
                screenSpaceError: ({ spatial, camera }) => spatial.error * (camera.multiplier ?? 1),
            },
            content: {
                load: async (context) => ({ kind: "renderable", handle: context.uri }),
                attach: () => undefined,
                detach: () => undefined,
            },
        };
        const runtime = new TileRuntime({
            id: "delay",
            uri: "memory://tileset.json",
            adapter,
            maxScreenSpaceError: 10,
            refinementHysteresisRatio: 0.2,
            coarseningDelayMilliseconds: 300,
            preloadSiblings: false,
            clock: () => now,
        });
        const selected = () => runtime.selectedTiles.map((node) => node.id);
        const at = (milliseconds: number) => {
            now = milliseconds;
        };
        return { runtime, selected, at };
    }

    it("starts again when the refinement is required again: two low periods do not add up", async () => {
        const { runtime, selected, at } = createDelayed();
        await runtime.update({ multiplier: 1 });
        await runtime.whenIdle();
        await runtime.update({ multiplier: 1 });
        expect(selected()).toEqual(["delay/root/0"]);

        at(100);
        await runtime.update({ multiplier: 0.4 });
        at(200);
        await runtime.update({ multiplier: 1 });
        at(450);
        await runtime.update({ multiplier: 0.4 });
        expect(selected()).toEqual(["delay/root/0"]);
        at(749);
        await runtime.update({ multiplier: 0.4 });
        expect(selected()).toEqual(["delay/root/0"]);
        at(750);
        await runtime.update({ multiplier: 0.4 });
        expect(selected()).toEqual(["delay/root"]);
        await runtime.dispose();
    });

    it("asks for a frame when it expires, with a still camera and nothing loading", async () => {
        const { runtime, selected, at } = createDelayed();
        await runtime.update({ multiplier: 1 });
        await runtime.whenIdle();
        await runtime.update({ multiplier: 1 });

        at(100);
        await runtime.update({ multiplier: 0.4 });
        expect(runtime.hasPendingWork).toBe(false);
        at(399);
        expect(runtime.hasPendingWork).toBe(false);
        at(400);
        expect(runtime.hasPendingWork).toBe(true);

        await runtime.processFrame();
        expect(selected()).toEqual(["delay/root"]);
        expect(runtime.hasPendingWork).toBe(false);
        await runtime.dispose();
    });
});

describe("TileRuntime counters", () => {
    it("counts changes of the frame, not the attempts of its balance passes", async () => {
        const hierarchy = {
            asset: { version: "1.1" },
            geometricError: 16,
            root: {
                boundingVolume: { sphere: [0, 0, 0, 2] },
                geometricError: 16,
                refine: "REPLACE",
                content: { uri: "grid://root" },
                children: [child("child")],
            },
        } as unknown as ITileset;
        const adapter: IRuntimeAdapter<ICamera, ISpatial, string, never> = {
            tilesets: { load: async () => ({ tileset: hierarchy }) },
            spatial: {
                derive: (context) => ({ name: "", error: context.tile.geometricError }),
                isVisible: () => true,
                screenSpaceError: ({ spatial }) => spatial.error,
            },
            content: {
                load: async (context) => ({ kind: "renderable", handle: context.uri }),
                attach: () => undefined,
                detach: () => undefined,
            },
        };
        const runtime = new TileRuntime({
            id: "count",
            uri: "memory://tileset.json",
            adapter,
            maxScreenSpaceError: 10,
            preloadSiblings: false,
            instrumentation: { enabled: true },
        });
        const metric = (name: "tile.refine" | "tile.coarsen" | "cut.entered") =>
            runtime.instrumentation.snapshot().metrics[name]?.count ?? 0;

        await runtime.update({});
        await runtime.whenIdle();
        await runtime.update({});
        const refinements = metric("tile.refine");
        const entered = metric("cut.entered");
        expect(refinements).toBe(1);
        expect(entered).toBeGreaterThan(0);

        for (let i = 0; i < 5; i++) await runtime.update({});
        expect(metric("tile.refine")).toBe(refinements);
        expect(metric("tile.coarsen")).toBe(0);
        expect(metric("cut.entered")).toBe(entered);
        await runtime.dispose();
    });
});
