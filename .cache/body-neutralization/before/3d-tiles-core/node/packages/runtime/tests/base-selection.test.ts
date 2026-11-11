import type { ITile, ITileset } from "@spacexr/3d-tiles-core";
import { childTileAddresses } from "@spacexr/tiles";
import { describe, expect, it } from "vitest";

import type { IContentLoadContext, IRuntimeAdapter, ISpatialDerivationContext, ISpatialMetric } from "../src";
import { DenseImplicitSubtreeLoader, TileRuntime, createWebMapImplicitSource, quadtreeImbalances, refineQuadtreeCut } from "../src";

interface ICamera {
    focus?: number;
    hideEast?: boolean;
    error?: number;
    periphery?: boolean;
}

interface ISpatial {
    region: readonly number[];
    x: number;
    error: number;
}

class Metric implements ISpatialMetric<ICamera, ISpatial> {
    public derive(context: ISpatialDerivationContext<ISpatial>): ISpatial {
        return {
            region: context.tile.boundingVolume.region ?? [],
            x: context.tile.boundingVolume.sphere?.[0] ?? 0,
            error: context.tile.geometricError,
        };
    }

    public isVisible(spatial: ISpatial, camera: ICamera): boolean {
        return spatial.region.length > 0 ? !camera.hideEast || spatial.region[0]! < 0 : spatial.x >= 0;
    }

    /** With `periphery`, the hidden eastern half is the periphery of the view. */
    public isInPeriphery(spatial: ISpatial, camera: ICamera): boolean {
        return camera.periphery === true && !this.isVisible(spatial, camera);
    }

    public screenSpaceError({ camera, spatial }: { camera: ICamera; spatial: ISpatial }): number {
        if (spatial.region.length > 0 && camera.error !== undefined) return camera.error;
        if (spatial.region.length > 0) return camera.focus! >= spatial.region[0]! && camera.focus! <= spatial.region[2]! ? 1000 : 0;
        return spatial.error > 0 ? (camera.error ?? 100) : 0;
    }
}

const leaf = (uri: string, x = 1): ITile => ({ boundingVolume: { sphere: [x, 0, 0, 1] }, geometricError: 0, content: { uri } });

function explicitRuntime(
    children: [ITile, ...ITile[]],
    delayed?: (uri: string) => Promise<void> | undefined,
    refine: "ADD" | "REPLACE" = "REPLACE",
    empty: readonly string[] = [],
) {
    const loads: string[] = [];
    const tileset: ITileset = {
        asset: { version: "1.1" },
        geometricError: 100,
        root: { ...leaf("root.glb"), geometricError: 100, refine, children },
    };
    const adapter: IRuntimeAdapter<ICamera, ISpatial, string, never> = {
        tilesets: { load: async () => ({ tileset, baseUri: "https://example.test/" }) },
        spatial: new Metric(),
        content: {
            load: async (context) => {
                loads.push(context.uri);
                await delayed?.(context.uri);
                return empty.some((name) => context.uri.endsWith(name)) ? { kind: "empty" } : { kind: "renderable", handle: context.uri };
            },
            attach: () => undefined,
            detach: () => undefined,
        },
    };
    const runtime = new TileRuntime({
        id: "base",
        uri: "https://example.test/tileset.json",
        adapter,
        selectionStrategy: "base",
        coarseningDelayMilliseconds: 0,
        maxConcurrentLoads: 8,
        cache: { maxContentEntries: 1 },
    });
    return { runtime, loads, selected: () => runtime.selectedTiles.map((tile) => tile.source.content?.uri).sort() };
}

async function tick(runtime: ReturnType<typeof explicitRuntime>["runtime"], frames = 5): Promise<void> {
    for (let i = 0; i < frames; i++) {
        await runtime.update({});
        await new Promise((resolve) => setTimeout(resolve, 0));
    }
}

describe("TileRuntime base selection", () => {
    it("prepares the hidden replacement sibling but never refines its hierarchy by SSE", async () => {
        let release!: () => void;
        const gate = new Promise<void>((resolve) => (release = resolve));
        const hidden: ITile = { ...leaf("hidden.glb", -1), geometricError: 100, children: [leaf("hidden-child.glb", -1)] };
        const { runtime, loads, selected } = explicitRuntime([leaf("visible.glb"), hidden], (uri) =>
            uri.endsWith("hidden.glb") ? gate : undefined,
        );
        await tick(runtime);
        expect(selected()).toEqual(["root.glb"]);
        expect(loads.some((uri) => uri.endsWith("hidden.glb"))).toBe(true);
        expect(loads.some((uri) => uri.endsWith("hidden-child.glb"))).toBe(false);
        release();
        await runtime.whenIdle();
        expect(selected()).toEqual(["visible.glb"]);
        expect(loads.some((uri) => uri.endsWith("hidden-child.glb"))).toBe(false);
        await runtime.dispose();
    });

    it("replaces the parent when a visible sibling is a known empty leaf", async () => {
        const structural: ITile = { boundingVolume: { sphere: [1, 0, 0, 1] }, geometricError: 0 };
        const { runtime, selected } = explicitRuntime([leaf("visible.glb"), structural, leaf("empty.glb")], undefined, "REPLACE", [
            "empty.glb",
        ]);
        await tick(runtime);
        expect(selected()).toEqual(["visible.glb"]);
        await runtime.update({});
        await runtime.whenIdle();
        expect(selected()).toEqual(["visible.glb"]);
        await runtime.dispose();
    });

    it("retains ready descendants beside known empty leaves until their coarser parent is ready", async () => {
        let release!: () => void;
        const gate = new Promise<void>((resolve) => (release = resolve));
        const structural: ITile = { boundingVolume: { sphere: [1, 0, 0, 1] }, geometricError: 0 };
        const { runtime, selected } = explicitRuntime(
            [leaf("visible.glb"), structural, leaf("empty.glb")],
            (uri) => (uri.endsWith("root.glb") ? gate : undefined),
            "REPLACE",
            ["empty.glb"],
        );
        try {
            await tick(runtime);
            expect(selected()).toEqual(["visible.glb"]);
            await runtime.update({ error: 0 });
            expect(selected()).toEqual(["visible.glb"]);
            release();
            await runtime.whenIdle();
            expect(selected()).toEqual(["root.glb"]);
        } finally {
            release();
            await runtime.dispose();
        }
    });

    it("keeps ready coverage ancestors under cache pressure and coarsens without reloading", async () => {
        const { runtime, loads, selected } = explicitRuntime([leaf("first.glb"), leaf("second.glb")]);
        await runtime.update({});
        await runtime.whenIdle();
        expect(selected()).toEqual(["first.glb", "second.glb"]);
        await runtime.trimCache(true);
        await runtime.update({ error: 0 });
        await runtime.whenIdle();
        expect(selected()).toEqual(["root.glb"]);
        expect(loads.filter((uri) => uri.endsWith("root.glb"))).toHaveLength(1);
        await runtime.dispose();
    });

    it.each([false, true])("rejects a late cold sibling through a shared ancestor, with balancing=%s", async (quadtreeBalance) => {
        let releaseSchema!: () => void;
        let releaseCold!: () => void;
        const schemaGate = new Promise<void>((resolve) => (releaseSchema = resolve));
        const coldGate = new Promise<void>((resolve) => (releaseCold = resolve));
        const tileset: ITileset = {
            asset: { version: "1.1" },
            geometricError: 100,
            root: {
                ...leaf("root.glb", 0),
                geometricError: 100,
                refine: "REPLACE",
                children: [{ ...leaf("middle.glb"), geometricError: 100, children: [leaf("fine.glb")] }, leaf("external.json", -1)],
            },
        };
        const adapter: IRuntimeAdapter<ICamera, ISpatial, string, never> = {
            tilesets: { load: async () => ({ tileset, baseUri: "https://example.test/" }) },
            metadataSchemas: {
                load: async () => {
                    await schemaGate;
                    return { id: "late-schema", classes: {} };
                },
            },
            spatial: {
                derive: (context) => new Metric().derive(context),
                isVisible: (spatial, camera) => spatial.x >= 0 || !camera.hideEast,
                screenSpaceError: ({ spatial, camera }) => (spatial.error > 0 ? (camera.error ?? 1000) : 0),
            },
            content: {
                load: async ({ uri }) => {
                    if (uri.endsWith("external.json"))
                        return {
                            kind: "external-tileset",
                            tileset: { asset: { version: "1.1" }, geometricError: 0, schemaUri: "schema.json", root: leaf("cold.glb", -1) },
                        };
                    if (uri.endsWith("cold.glb")) await coldGate;
                    return { kind: "renderable", handle: uri };
                },
                attach: () => undefined,
                detach: () => undefined,
            },
        };
        const runtime = new TileRuntime({
            id: "late-external",
            uri: "https://example.test/root.json",
            adapter,
            selectionStrategy: "base",
            quadtreeBalance,
            coarseningDelayMilliseconds: 0,
            maxConcurrentLoads: 16,
            cache: false,
        });
        const selected = () => runtime.selectedTiles.map((tile) => tile.source.content?.uri).sort();
        const tickHidden = async () => {
            await runtime.update({ hideEast: true });
            await new Promise((resolve) => setTimeout(resolve, 0));
        };
        try {
            for (let frame = 0; frame < 8; frame++) await tickHidden();
            expect(selected()).toEqual(["fine.glb"]);
            releaseSchema();
            for (let frame = 0; frame < 3; frame++) await tickHidden();
            await runtime.update({ hideEast: false });
            expect(selected()).toEqual(["fine.glb"]);
            // Explicit SSE coarsening still wins over the retained detailed cut.
            await runtime.update({ hideEast: false, error: 0 });
            expect(selected()).toEqual(["root.glb"]);
            await runtime.update({ hideEast: false });
            releaseCold();
            await runtime.whenIdle();
            expect(selected()).toEqual(["cold.glb", "fine.glb"]);
        } finally {
            releaseSchema();
            releaseCold();
            await runtime.dispose();
        }
    });

    it("preserves additive selection semantics", async () => {
        const { runtime, selected } = explicitRuntime([leaf("first.glb"), leaf("second.glb")], undefined, "ADD");
        await runtime.update({});
        await runtime.whenIdle();
        expect(selected()).toEqual(["first.glb", "root.glb", "second.glb"]);
        await runtime.dispose();
    });

    it("continues through empty structural replacement nodes", async () => {
        const empty: ITile = { boundingVolume: { sphere: [1, 0, 0, 2] }, geometricError: 100, children: [leaf("deep.glb")] };
        const { runtime, selected } = explicitRuntime([empty, leaf("sibling.glb")]);
        await runtime.update({});
        await runtime.whenIdle();
        expect(selected()).toEqual(["deep.glb", "sibling.glb"]);
        await runtime.dispose();
    });
});

function implicitRuntime(delayed?: (address: { lod: number; x: number; y: number }) => Promise<void> | undefined) {
    const source = createWebMapImplicitSource({ urlTemplates: "grid://{z}/{x}/{y}", maximumZoom: 4, subtreeLevels: 5 });
    const adapter: IRuntimeAdapter<ICamera, ISpatial, string, never> = {
        tilesets: { load: async () => ({ tileset: source.tileset }) },
        subtrees: new DenseImplicitSubtreeLoader(),
        implicitTiles: source.resolver,
        spatial: new Metric(),
        content: {
            load: async (context: IContentLoadContext<ISpatial>) => {
                await delayed?.(source.dataSource.addressOf(context.implicitCoordinates!));
                return { kind: "renderable", handle: context.uri };
            },
            attach: () => undefined,
            detach: () => undefined,
        },
    };
    const runtime = new TileRuntime({
        id: "base-implicit",
        uri: "memory://base/tileset.json",
        adapter,
        selectionStrategy: "base",
        quadtreeBalance: true,
        maxScreenSpaceError: 1,
        coarseningDelayMilliseconds: 0,
        maxConcurrentLoads: 16,
    });
    const selected = () => runtime.selectedTiles.map((tile) => source.dataSource.addressOf(tile.implicit!.coordinates));
    const imbalances = () =>
        quadtreeImbalances(selected().map((address) => ({ location: { namespace: "", address, wrapX: false }, value: address })));
    return { runtime, selected, imbalances };
}

describe("TileRuntime base quadtree closure", () => {
    it("publishes only balanced ready cuts while support tiles are delayed and resumes detail when they arrive", async () => {
        let release!: () => void;
        const gate = new Promise<void>((resolve) => (release = resolve));
        const { runtime, selected, imbalances } = implicitRuntime((address) => (address.lod === 2 && address.x >= 2 ? gate : undefined));
        const camera = { focus: -0.01 };
        for (let frame = 0; frame < 20; frame++) {
            const result = await runtime.update(camera);
            expect(result.unbalanced).toEqual([]);
            expect(imbalances()).toEqual([]);
            await new Promise((resolve) => setTimeout(resolve, 0));
        }
        expect(selected().reduce((area, tile) => area + 4 ** -tile.lod, 0)).toBe(1);
        expect(Math.max(...selected().map((tile) => tile.lod))).toBeLessThan(4);
        release();
        await runtime.whenIdle();
        expect(Math.max(...selected().map((tile) => tile.lod))).toBe(4);
        expect(imbalances()).toEqual([]);
        expect(runtime.hasPendingWork).toBe(false);
        await runtime.dispose();
    });

    it("retains existing fine geometry until a newly visible neighbour can enter within one level", async () => {
        let release!: () => void;
        const gate = new Promise<void>((resolve) => (release = resolve));
        const { runtime, selected, imbalances } = implicitRuntime((address) => (address.lod === 2 && address.x >= 2 ? gate : undefined));
        // A hidden direct sibling is prepared but its descendants never block this western branch.
        const west = { focus: -0.01, hideEast: true };
        for (let frame = 0; frame < 20; frame++) {
            await runtime.update(west);
            await new Promise((resolve) => setTimeout(resolve, 0));
        }
        expect(Math.max(...selected().map((tile) => tile.lod))).toBe(4);
        const previous = selected();
        for (let frame = 0; frame < 4; frame++) {
            const result = await runtime.update({ focus: -0.01 });
            expect(result.unbalanced).toEqual([]);
            expect(imbalances()).toEqual([]);
            expect(selected()).toEqual(previous);
            expect(selected().some((tile) => tile.x >= 2 ** (tile.lod - 1))).toBe(false);
        }
        release();
        await runtime.whenIdle();
        expect(Math.max(...selected().map((tile) => tile.lod))).toBe(4);
        expect(selected().reduce((area, tile) => area + 4 ** -tile.lod, 0)).toBe(1);
        expect(imbalances()).toEqual([]);
        await runtime.dispose();
    });

    it("keeps the displayed tile in place of a refinement that is not displayable, and publishes the rest", async () => {
        let release!: () => void;
        const gate = new Promise<void>((resolve) => (release = resolve));
        // The children of 2/0/1 are cold: a refinement beside it would be two levels finer.
        const { runtime, selected, imbalances } = implicitRuntime((address) =>
            address.lod === 3 && address.x <= 1 && (address.y === 2 || address.y === 3) ? gate : undefined,
        );
        const area = () => selected().reduce((sum, tile) => sum + 4 ** -tile.lod, 0);
        try {
            for (let frame = 0; frame < 20; frame++) {
                await runtime.update({ focus: -0.01 });
                await new Promise((resolve) => setTimeout(resolve, 0));
            }
            expect(selected().some((tile) => tile.lod === 4 && tile.x === 7)).toBe(true);
            // The focus moves to the western column: the old column coarsens while the new one waits for 2/0/1.
            for (let frame = 0; frame < 6; frame++) {
                const result = await runtime.update({ focus: -3 });
                expect(result.unbalanced).toEqual([]);
                expect(imbalances()).toEqual([]);
                expect(area()).toBe(1);
                await new Promise((resolve) => setTimeout(resolve, 0));
            }
            const names = selected().map((tile) => `${tile.lod}/${tile.x}/${tile.y}`);
            // The old column coarsened, the new one refined wherever it is displayable, and 2/0/1 waits for its children.
            expect(selected().some((tile) => tile.x === 2 ** tile.lod / 2 - 1 && tile.lod > 2)).toBe(false);
            expect(names).toContain("2/0/1");
            expect(names).toContain("3/0/1");
            expect(names).toContain("4/0/0");
            expect(names).toContain("4/0/15");
            release();
            await runtime.whenIdle();
            expect(selected().some((tile) => tile.lod === 4 && tile.x === 0)).toBe(true);
            expect(imbalances()).toEqual([]);
            expect(area()).toBe(1);
        } finally {
            release();
            await runtime.dispose();
        }
    });

    it("loads the periphery without selecting it, and draws it at once when it enters the view", async () => {
        const { runtime, selected, imbalances } = implicitRuntime();
        try {
            await runtime.update({ error: 1000, hideEast: true, periphery: true });
            await runtime.whenIdle();
            await runtime.update({ error: 1000, hideEast: true, periphery: true });
            expect(selected().some((tile) => tile.x >= 2 ** tile.lod / 2)).toBe(false);
            const result = await runtime.update({ error: 1000 });
            const east = result.selected.filter((tile) => tile.implicit && tile.depth === 4 && tile.visible);
            expect(east.length).toBe(2 ** 8);
            expect(imbalances()).toEqual([]);
        } finally {
            await runtime.dispose();
        }
    });

    it("loads nothing hidden without a periphery", async () => {
        const { runtime, selected } = implicitRuntime();
        try {
            await runtime.update({ error: 1000, hideEast: true });
            await runtime.whenIdle();
            await runtime.update({ error: 1000, hideEast: true });
            const result = await runtime.update({ error: 1000 });
            expect(result.selected.filter((tile) => tile.depth === 4).length).toBe(2 ** 7);
            expect(selected().some((tile) => tile.x >= 2 ** tile.lod / 2 && tile.lod === 4)).toBe(false);
        } finally {
            await runtime.dispose();
        }
    });

    it("admits warm yaw changes in the same frame and still allows compatible SSE coarsening", async () => {
        const { runtime, selected, imbalances } = implicitRuntime();
        await runtime.update({ error: 1000 });
        await runtime.whenIdle();
        for (let frame = 0; frame < 12; frame++) {
            await runtime.update({ focus: -0.01, hideEast: frame % 2 === 0 });
            expect(imbalances()).toEqual([]);
            expect(selected().find((tile) => tile.x === 2 ** (tile.lod - 1) - 1 && tile.y === 2 ** (tile.lod - 1) - 1)?.lod).toBe(4);
        }
        await runtime.whenIdle();
        expect(runtime.hasPendingWork).toBe(false);
        await runtime.update({ error: 0 });
        await runtime.whenIdle();
        expect(selected()).toEqual([{ lod: 0, x: 0, y: 0 }]);
        expect(runtime.hasPendingWork).toBe(false);
        await runtime.dispose();
    });
});

describe("refineQuadtreeCut admission", () => {
    const tile = (lod: number, x: number, y: number, namespace = "") => ({
        location: { namespace, address: { lod, x, y }, wrapX: false },
        value: `${namespace}${lod}/${x}/${y}`,
    });
    const children = (entry: ReturnType<typeof tile>) =>
        childTileAddresses(entry.location.address).map((address) => tile(address.lod, address.x, address.y, entry.location.namespace));

    it("refines ready neighbours in a local queue without changing the existing fine leaf", () => {
        const fine = tile(4, 7, 7);
        const cut = refineQuadtreeCut([fine, tile(2, 2, 1), tile(1, 1, 1)], children)!;
        expect(cut).toContain(fine);
        expect(quadtreeImbalances(cut)).toEqual([]);
        expect(cut.some((entry) => entry.location.address.lod === 3 && entry.location.address.x === 4)).toBe(true);
    });

    it("rejects a cold transaction and terminates the fine, ready middle, cold outer neighbour chain", () => {
        const displayed = [tile(4, 7, 7), tile(2, 2, 1), tile(1, 1, 1)];
        const requests: string[] = [];
        const involved = new Set<string>();
        const result = refineQuadtreeCut(
            displayed,
            (entry) => {
                requests.push(entry.value);
                return entry.location.address.lod === 1 ? undefined : children(entry);
            },
            (tiles) => tiles.forEach((entry) => involved.add(entry.value)),
        );
        expect(result).toBeUndefined();
        // The split of 2/2/1 was made for 4/7/7, and its front is the one 1/1/1 refuses.
        expect([...involved].sort()).toEqual(["1/1/1", "2/2/1", "4/7/7"]);
        expect(requests.filter((value) => value === "2/2/1")).toHaveLength(1);
        expect(requests.length).toBeLessThan(10);
        expect(displayed.map((entry) => entry.value)).toEqual(["4/7/7", "2/2/1", "1/1/1"]);
    });

    it("rejects refinement fronts that overlap, cross namespaces or fail to increase depth", () => {
        const displayed = [tile(4, 7, 7), tile(2, 2, 1)];
        expect(() => refineQuadtreeCut(displayed, (entry) => [entry])).toThrow("strict descendants");
        expect(() => refineQuadtreeCut(displayed, () => [tile(3, 4, 2, "other:")])).toThrow("namespace");
        expect(() => refineQuadtreeCut(displayed, () => [tile(3, 4, 2), tile(4, 8, 4)])).toThrow("overlap");
    });
});
