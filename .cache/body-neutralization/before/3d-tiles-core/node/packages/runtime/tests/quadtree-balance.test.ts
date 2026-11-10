import { describe, expect, it } from "vitest";

import type { IContentLoadContext, IRuntimeAdapter, ISpatialDerivationContext, ISpatialMetric } from "../src";
import {
    DenseImplicitSubtreeLoader,
    TileRuntime,
    createWebMapImplicitSource,
    quadtreeBalanceRefinements,
    quadtreeImbalances,
} from "../src";

describe("quadtreeBalanceRefinements", () => {
    it("refines every ancestor of an edge neighbour two or more levels coarser", () => {
        const refinements = quadtreeBalanceRefinements([{ namespace: "", address: { lod: 4, x: 7, y: 3 }, wrapX: false }]);

        // East neighbour 4/8/3: its ancestors at levels 2, 1 and 0.
        expect(refinements.has("2/2/0")).toBe(true);
        expect(refinements.has("1/1/0")).toBe(true);
        expect(refinements.has("0/0/0")).toBe(true);
        // The neighbour's parent, one level coarser, may stay displayed.
        expect(refinements.has("3/4/1")).toBe(false);
        // Diagonal neighbours do not constrain the tile.
        expect(refinements.has("2/2/1")).toBe(false);
    });

    it("stops at the pyramid edges unless columns wrap", () => {
        const corner = { namespace: "", address: { lod: 3, x: 0, y: 0 }, wrapX: false };

        expect(quadtreeBalanceRefinements([corner]).has("1/1/0")).toBe(false);
        expect(quadtreeBalanceRefinements([{ ...corner, wrapX: true }]).has("1/1/0")).toBe(true);
    });

    it("keeps namespaces apart", () => {
        const refinements = quadtreeBalanceRefinements([{ namespace: "a:", address: { lod: 2, x: 1, y: 1 }, wrapX: false }]);

        expect([...refinements].every((key) => key.startsWith("a:"))).toBe(true);
    });
});

interface ICamera {
    /** Longitude and latitude, in radians, where the screen-space error is high. */
    focus: readonly [number, number];
    /** Hides the tiles east of the prime meridian, as if they were outside the view. */
    hideEast?: boolean;
    /** Hides the tiles of the regions it accepts, as if they were outside the view. */
    hidden?: ((region: readonly number[]) => boolean) | undefined;
}

interface ISpatial {
    region: readonly number[];
}

/** Refines only the tiles containing the focus point, as a camera close to the ground would. */
class FocusMetric implements ISpatialMetric<ICamera, ISpatial> {
    public derive(context: ISpatialDerivationContext<ISpatial>): ISpatial {
        return { region: context.tile.boundingVolume.region ?? [] };
    }

    public isVisible(spatial: ISpatial, camera: ICamera): boolean {
        if (camera.hidden?.(spatial.region)) return false;
        return !camera.hideEast || spatial.region[0]! < 0;
    }

    public screenSpaceError({ camera, spatial }: { camera: ICamera; spatial: ISpatial }): number {
        const [west, south, east, north] = spatial.region;
        const [longitude, latitude] = camera.focus;
        return longitude >= west! && longitude <= east! && latitude >= south! && latitude <= north! ? 1000 : 0;
    }
}

function largestEdgeJump(tiles: ReadonlyArray<{ lod: number; x: number; y: number }>): number {
    let largestJump = 0;
    for (const tile of tiles) {
        for (const other of tiles) {
            const scale = 2 ** -tile.lod;
            const otherScale = 2 ** -other.lod;
            const [x0, y0, x1, y1] = [tile.x * scale, tile.y * scale, (tile.x + 1) * scale, (tile.y + 1) * scale];
            const [u0, v0, u1, v1] = [other.x * otherScale, other.y * otherScale, (other.x + 1) * otherScale, (other.y + 1) * otherScale];
            const overlapX = Math.min(x1, u1) - Math.max(x0, u0) > 0;
            const overlapY = Math.min(y1, v1) - Math.max(y0, v0) > 0;
            const sharesEdge = ((x1 === u0 || u1 === x0) && overlapY) || ((y1 === v0 || v1 === y0) && overlapX);
            if (sharesEdge) largestJump = Math.max(largestJump, Math.abs(tile.lod - other.lod));
        }
    }
    return largestJump;
}

/** Runtime focusing just west of the prime meridian, so that the deepest tiles touch the eastern half of the map. */
function createScenario(
    quadtreeBalance: boolean | { fillGaps: boolean },
    delayed?: (address: { lod: number; x: number; y: number }) => Promise<void> | undefined,
    preloadSiblings = false,
    coarseningDelayMilliseconds = 0,
    clock?: () => number,
) {
    const source = createWebMapImplicitSource({ urlTemplates: "grid://{z}/{x}/{y}", maximumZoom: 3, subtreeLevels: 4 });
    const adapter: IRuntimeAdapter<ICamera, ISpatial, string, never> = {
        tilesets: { load: async () => ({ tileset: source.tileset }) },
        subtrees: new DenseImplicitSubtreeLoader(),
        implicitTiles: source.resolver,
        spatial: new FocusMetric(),
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
        id: "balance",
        uri: "memory://balance/tileset.json",
        adapter,
        maxScreenSpaceError: 1,
        quadtreeBalance,
        preloadSiblings,
        coarseningDelayMilliseconds,
        ...(clock ? { clock } : {}),
        // More load slots than delayed tiles, so that the delayed loads do not block the others.
        maxConcurrentLoads: 8,
    });
    const camera: ICamera = { focus: [-0.01, 0.3] };
    const selected = () => runtime.selectedTiles.map((tile) => source.dataSource.addressOf(tile.implicit!.coordinates));
    return { runtime, camera, selected };
}

async function selectedLevels(quadtreeBalance: boolean) {
    const { runtime, camera, selected } = createScenario(quadtreeBalance);
    await runtime.update(camera);
    await runtime.whenIdle();
    const tiles = selected();
    await runtime.dispose();
    return { levels: tiles.map((tile) => tile.lod), largestJump: largestEdgeJump(tiles) };
}

describe("TileRuntime quadtree balance", () => {
    it("lets independent branches differ by several levels without balancing", async () => {
        const { levels, largestJump } = await selectedLevels(false);

        expect(Math.max(...levels)).toBe(3);
        expect(largestJump).toBe(2);
    });

    it("refines coarse neighbours until every edge joins levels at most one apart", async () => {
        const { levels, largestJump } = await selectedLevels(true);

        expect(Math.max(...levels)).toBe(3);
        expect(largestJump).toBe(1);
    });

    it("holds a refinement that a neighbour cannot follow until the neighbour is ready", async () => {
        // The eastern level 2 tiles, which the balance requires next to the focus, load late.
        let release: () => void = () => undefined;
        const gate = new Promise<void>((resolve) => (release = resolve));
        const { runtime, camera, selected } = createScenario(true, (address) => (address.lod === 2 && address.x >= 2 ? gate : undefined));

        for (let frame = 0; frame < 40; frame++) {
            await runtime.update(camera);
            await new Promise((resolve) => setTimeout(resolve, 0));
        }
        const waiting = selected();
        expect(largestEdgeJump(waiting)).toBe(1);
        expect(Math.max(...waiting.map((tile) => tile.lod))).toBe(2);

        release();
        await runtime.update(camera);
        await runtime.whenIdle();
        const ready = selected();
        expect(largestEdgeJump(ready)).toBe(1);
        expect(Math.max(...ready.map((tile) => tile.lod))).toBe(3);
        await runtime.dispose();
    });
});

describe("TileRuntime quadtree balance while turning", () => {
    /** The whole of a tile enters the view while most of its children load; gives the smallest area covered meanwhile. */
    async function coveredWhileLoading(quadtreeBalance: boolean | { fillGaps: boolean }): Promise<number> {
        let release: () => void = () => undefined;
        const gate = new Promise<void>((resolve) => (release = resolve));
        // The north-western tile N of level 1 has children A, its north-western one, and three others that never loaded.
        const northWestChild = (address: { lod: number; x: number; y: number }) => address.lod === 2 && address.x < 2 && address.y < 2;
        const { runtime, camera, selected } = createScenario(quadtreeBalance, (address) =>
            northWestChild(address) && (address.x > 0 || address.y > 0) ? gate : undefined,
        );
        const a = { lod: 2, x: 0, y: 0 };
        const isA = (tile: { lod: number; x: number; y: number }) => tile.lod === a.lod && tile.x === a.x && tile.y === a.y;
        // Only A is in view inside N. The focus just east of the prime meridian makes the balance refine N.
        camera.focus = [0.01, 0.3];
        const smallerThanN = (region: readonly number[]) => region[2]! - region[0]! < Math.PI - 1e-9;
        camera.hidden = (region) =>
            smallerThanN(region) && region[2]! <= 1e-9 && region[1]! >= -1e-9 && !(region[2]! <= -Math.PI / 2 + 1e-9 && region[1]! >= 1.16);
        for (let frame = 0; frame < 20; frame++) {
            await runtime.update(camera);
            await new Promise((resolve) => setTimeout(resolve, 0));
        }
        expect(selected().some(isA)).toBe(true);

        // The whole of N enters the view while the three other children load: A alone would leave them empty.
        camera.hidden = undefined;
        const coveredArea = () => selected().reduce((area, tile) => area + 4 ** -tile.lod, 0);
        let smallest = 1;
        for (let frame = 0; frame < 10; frame++) {
            await runtime.update(camera);
            smallest = Math.min(smallest, coveredArea());
            await new Promise((resolve) => setTimeout(resolve, 0));
        }

        release();
        for (let frame = 0; frame < 4; frame++) {
            await runtime.update(camera);
            await runtime.whenIdle();
        }
        expect(coveredArea()).toBe(1);
        expect(largestEdgeJump(selected())).toBe(1);
        await runtime.dispose();
        return smallest;
    }

    it("leaves no empty area with fillGaps, when the refinements it keeps do not cover the tile the balance refines", async () => {
        expect(await coveredWhileLoading({ fillGaps: true })).toBe(1);
    });

    it("keeps the refinements it displays by default, even when they do not cover the tile", async () => {
        expect(await coveredWhileLoading(true)).toBeLessThan(1);
    });

    it("keeps a displayed refinement when a neighbour it cannot follow comes into view", async () => {
        let release: () => void = () => undefined;
        const gate = new Promise<void>((resolve) => (release = resolve));
        const { runtime, camera, selected } = createScenario(
            true,
            (address) => (address.lod === 2 && address.x >= 2 ? gate : undefined),
            true,
        );
        const settle = async (frames: number) => {
            for (let frame = 0; frame < frames; frame++) {
                await runtime.update(camera);
                await new Promise((resolve) => setTimeout(resolve, 0));
            }
        };

        // The eastern half is out of view: the focus refines to the deepest level without any neighbour to balance.
        camera.hideEast = true;
        await settle(20);
        expect(Math.max(...selected().map((tile) => tile.lod))).toBe(3);

        // The camera turns east: coarse eastern tiles come into view while the children they need still load.
        camera.hideEast = false;
        const levels: number[] = [];
        let unbalanced = 0;
        for (let frame = 0; frame < 20; frame++) {
            const result = await runtime.update(camera);
            levels.push(Math.max(...selected().map((tile) => tile.lod)));
            unbalanced = Math.max(unbalanced, result.unbalanced.length);
            await new Promise((resolve) => setTimeout(resolve, 0));
        }
        // The displayed refinement never coarsens; the waiting edges are reported instead.
        expect(levels.every((level) => level === 3)).toBe(true);
        expect(unbalanced).toBeGreaterThan(0);

        release();
        await runtime.update(camera);
        await runtime.whenIdle();
        await runtime.update(camera);
        expect(largestEdgeJump(selected())).toBe(1);
        expect(Math.max(...selected().map((tile) => tile.lod))).toBe(3);
        await runtime.dispose();
    });
});

describe("TileRuntime coarsening delay", () => {
    async function deepestLevelsAfterMovingAway(coarseningDelayMilliseconds: number): Promise<number[]> {
        let now = 0;
        const { runtime, camera, selected } = createScenario(false, undefined, false, coarseningDelayMilliseconds, () => now);
        await runtime.update(camera);
        await runtime.whenIdle();
        await runtime.update(camera);
        expect(Math.max(...selected().map((tile) => tile.lod))).toBe(3);

        // The focus moves to the other side of the map: nothing requires the refinement any more.
        const away: ICamera = { focus: [2.5, -0.8] };
        const levels: number[] = [];
        for (let frame = 0; frame < 6; frame++) {
            now = frame * 100;
            await runtime.update(away);
            levels.push(
                Math.max(
                    ...selected()
                        .filter((tile) => tile.x < 2 ** tile.lod / 2)
                        .map((tile) => tile.lod),
                ),
            );
        }
        await runtime.dispose();
        return levels;
    }

    it("keeps a refinement for the configured time once nothing requires it", async () => {
        expect(await deepestLevelsAfterMovingAway(300)).toEqual([3, 3, 3, 1, 1, 1]);
    });

    it("coarsens at once without delay", async () => {
        expect((await deepestLevelsAfterMovingAway(0))[0]).toBe(1);
    });
});

describe("TileRuntime quadtree imbalance reporting", () => {
    it("reports the edges left unbalanced in each frame, and none once balanced", async () => {
        const { runtime, camera } = createScenario(true);
        const frames: number[] = [];
        const imbalanceEvents: number[] = [];
        runtime.events.subscribe((event) => {
            if (event.type === "frame") frames.push(event.result.unbalanced.length);
            if (event.type === "quadtree-imbalance") imbalanceEvents.push(event.imbalances.length);
        });

        await runtime.update(camera);
        await runtime.whenIdle();
        const result = await runtime.update(camera);

        expect(result.unbalanced).toEqual([]);
        expect(runtime.instrumentation.snapshot().nodes.unbalanced).toBe(0);
        // Every reported imbalance was announced by an event in the same frame.
        expect(imbalanceEvents).toEqual(frames.filter((count) => count > 0));
        await runtime.dispose();
    });

    it("reports nothing without quadtree balance", async () => {
        const { runtime, camera } = createScenario(false);
        await runtime.update(camera);
        await runtime.whenIdle();

        expect((await runtime.update(camera)).unbalanced).toEqual([]);
        await runtime.dispose();
    });
});

describe("quadtreeImbalances", () => {
    it("reports displayed tiles next to a tile two or more levels coarser", () => {
        const location = (lod: number, x: number, y: number) => ({ namespace: "", address: { lod, x, y }, wrapX: false });
        const imbalances = quadtreeImbalances([
            { location: location(3, 3, 1), value: "fine" },
            { location: location(1, 1, 0), value: "coarse" },
            { location: location(2, 1, 1), value: "balanced" },
        ]);

        expect(imbalances).toEqual([{ fine: "fine", coarseLod: 1 }]);
    });
});
