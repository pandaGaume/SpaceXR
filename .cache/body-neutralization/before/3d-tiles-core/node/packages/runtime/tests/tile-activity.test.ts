import type { ITile, ITileset } from "@spacexr/3d-tiles-core";
import { Ellipsoid, GeodeticSystem } from "@spacexr/geodesy";
import { describe, expect, it } from "vitest";

import type { IRuntimeAdapter, ISpatialDerivationContext, ISpatialMetric } from "../src";
import { EcefSpatialMetric, TileRuntime } from "../src";

describe("EcefSpatialMetric periphery", () => {
    const metric = new EcefSpatialMetric({ geodeticSystem: new GeodeticSystem(Ellipsoid.sphere("Body", 1000)), horizonCulling: false });
    const spatial = metric.derive({ tile: { boundingVolume: { sphere: [100, 0, 0, 1] }, geometricError: 1 } });
    // Planes keeping x below 50, and below 200.
    const view = [{ x: -1, y: 0, z: 0, w: 50 }];
    const wide = [{ x: -1, y: 0, z: 0, w: 200 }];
    const position = { x: 0, y: 0, z: 0 };

    it("sees a tile in the periphery that is out of the view", () => {
        const camera = { position, viewportHeight: 1080, frustumPlanes: view, peripheryFrustumPlanes: wide };
        expect(metric.isVisible(spatial, camera)).toBe(false);
        expect(metric.isInPeriphery(spatial, camera)).toBe(true);
    });

    it("has no periphery without its planes, or beyond them", () => {
        expect(metric.isInPeriphery(spatial, { position, viewportHeight: 1080, frustumPlanes: wide })).toBe(false);
        expect(metric.isInPeriphery(spatial, { position, viewportHeight: 1080, frustumPlanes: view, peripheryFrustumPlanes: view })).toBe(
            false,
        );
    });
});

describe("TileRuntime active tiles", () => {
    /** Where the tiles at a negative x stand from the camera. Tiles at x above 10 are always out of the view and its periphery. */
    type Place = "view" | "periphery" | "beyond";

    interface ICamera {
        place: Place;
        /** Screen-space error of every tile. */
        error: number;
    }

    interface ISpatial {
        geometricError: number;
        x: number;
    }

    class Metric implements ISpatialMetric<ICamera, ISpatial> {
        public derive(context: ISpatialDerivationContext<ISpatial>): ISpatial {
            return { geometricError: context.tile.geometricError, x: context.tile.boundingVolume.sphere?.[0] ?? 0 };
        }

        public isVisible(spatial: ISpatial, camera: ICamera): boolean {
            if (spatial.x > 10) return false;
            return spatial.x >= 0 || camera.place === "view";
        }

        public isInPeriphery(spatial: ISpatial, camera: ICamera): boolean {
            return spatial.x < 0 && camera.place === "periphery";
        }

        public screenSpaceError(context: { spatial: ISpatial; camera: ICamera }): number {
            return context.spatial.geometricError > 0 ? context.camera.error : 0;
        }
    }

    const leaf = (name: string, x: number): ITile => ({
        boundingVolume: { sphere: [x, 0, 0, 1] },
        geometricError: 0,
        content: { uri: `${name}.glb` },
    });

    function runtimeOf(children: [ITile, ...ITile[]]) {
        const tileset: ITileset = {
            asset: { version: "1.1" },
            geometricError: 100,
            root: { ...leaf("root", 0), geometricError: 100, refine: "REPLACE", children },
        };
        const adapter: IRuntimeAdapter<ICamera, ISpatial, string, string> = {
            tilesets: { load: () => Promise.resolve({ tileset, baseUri: "https://example.test/" }) },
            spatial: new Metric(),
            content: {
                load: (context) => Promise.resolve({ kind: "renderable", handle: context.uri }),
                attach: () => undefined,
                detach: () => undefined,
            },
        };
        return new TileRuntime({
            id: "active",
            uri: "https://example.test/tileset.json",
            adapter,
            maxScreenSpaceError: 10,
            coarseningDelayMilliseconds: 0,
        });
    }

    async function shown(runtime: ReturnType<typeof runtimeOf>, place: Place, error = 100): Promise<string[]> {
        for (let frame = 0; frame < 4; frame++) {
            await runtime.update({ place, error });
            await runtime.whenIdle();
        }
        return runtime.selectedTiles.map((node) => node.source.content?.uri ?? "").sort();
    }

    it("drops a tile without an address in a quadtree once it leaves the view and its periphery", async () => {
        const runtime = runtimeOf([leaf("centre", 1), leaf("beside", -1)]);
        expect(await shown(runtime, "view")).toEqual(["beside.glb", "centre.glb"]);
        expect(await shown(runtime, "periphery")).toEqual(["beside.glb", "centre.glb"]);
        expect(await shown(runtime, "beyond")).toEqual(["centre.glb"]);
        await runtime.dispose();
    });

    it("refines an active tile in the periphery, and its whole hierarchy goes with it", async () => {
        const parent: ITile = {
            boundingVolume: { sphere: [-1, 0, 0, 1] },
            geometricError: 100,
            refine: "REPLACE",
            content: { uri: "parent.glb" },
            children: [leaf("child", -1)],
        };
        const runtime = runtimeOf([leaf("centre", 1), parent]);
        expect(await shown(runtime, "view")).toEqual(["centre.glb", "child.glb"]);
        expect(await shown(runtime, "periphery")).toEqual(["centre.glb", "child.glb"]);
        expect(await shown(runtime, "beyond")).toEqual(["centre.glb"]);
        await runtime.dispose();
    });

    it("merges an active tile in the periphery by its error, like a visible one", async () => {
        const parent: ITile = {
            boundingVolume: { sphere: [-1, 0, 0, 1] },
            geometricError: 100,
            refine: "REPLACE",
            content: { uri: "parent.glb" },
            children: [leaf("child", -1)],
        };
        const runtime = runtimeOf([leaf("centre", 1), parent]);
        expect(await shown(runtime, "periphery")).toEqual(["centre.glb", "child.glb"]);
        await runtime.update({ place: "periphery", error: 1 });
        await runtime.whenIdle();
        await runtime.update({ place: "periphery", error: 1 });
        await runtime.whenIdle();
        expect(runtime.selectedTiles.map((node) => node.source.content?.uri).length).toBeGreaterThan(0);
        expect(runtime.selectedTiles.map((node) => node.source.content?.uri)).not.toContain("child.glb");
        await runtime.dispose();
    });

    it("never selects a tile that is neither visible nor in the periphery", async () => {
        const far: ITile = {
            boundingVolume: { sphere: [20, 0, 0, 1] },
            geometricError: 100,
            refine: "REPLACE",
            content: { uri: "far.glb" },
            children: [leaf("far-child", 20)],
        };
        const runtime = runtimeOf([leaf("centre", 1), far]);
        const tiles = await shown(runtime, "beyond");
        expect(tiles).toContain("centre.glb");
        expect(tiles).not.toContain("far-child.glb");
        await runtime.dispose();
    });

    it("does not bring a coarser tile into the view for an active tile that is not loaded", async () => {
        const loads = new Map<string, () => void>();
        const tileset: ITileset = {
            asset: { version: "1.1" },
            geometricError: 100,
            root: { ...leaf("root", 0), geometricError: 100, refine: "REPLACE", children: [leaf("centre", 1), leaf("beside", -1)] },
        };
        const adapter: IRuntimeAdapter<ICamera, ISpatial, string, string> = {
            tilesets: { load: () => Promise.resolve({ tileset, baseUri: "https://example.test/" }) },
            spatial: new Metric(),
            content: {
                load: (context) =>
                    context.uri.endsWith("beside.glb")
                        ? new Promise((resolve) => loads.set(context.uri, () => resolve({ kind: "renderable", handle: context.uri })))
                        : Promise.resolve({ kind: "renderable", handle: context.uri }),
                attach: () => undefined,
                detach: () => undefined,
            },
        };
        const runtime = new TileRuntime({
            id: "wait",
            uri: "https://example.test/tileset.json",
            adapter,
            maxScreenSpaceError: 10,
            coarseningDelayMilliseconds: 0,
        });
        for (let frame = 0; frame < 4; frame++) {
            await runtime.update({ place: "periphery", error: 100 });
            await new Promise((resolve) => setTimeout(resolve));
        }
        expect(runtime.selectedTiles.map((node) => node.source.content?.uri)).toEqual(["centre.glb"]);
        for (const finish of loads.values()) finish();
        await runtime.whenIdle();
        await runtime.dispose();
    });
});
