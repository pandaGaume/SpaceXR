import { CUBE_TILE_TOPOLOGY, TileNeighbor, type ITileAddress } from "@spacexr/tiles";
import { DemPyramid, createHeightGrid } from "@spacexr/dem";
import { afterEach, describe, expect, it, vi } from "vitest";

import { BabylonGeodesicGridPipeline, webMercatorTiling, type IBabylonGeodesicGridHandle } from "../src";
import { createNullScene } from "./helpers";

const SIDE = 257;

function createPipeline(junctionBudgetMilliseconds = 1000) {
    const scene = createNullScene();
    const pyramid = new DemPyramid({
        registration: "point",
        maxLOD: 6,
        load: async () => createHeightGrid(SIDE, SIDE, new Float32Array(SIDE * SIDE)),
    });
    const labels = {
        ownerDocument: { createElement: () => ({ style: { setProperty: () => undefined, display: "" }, remove: () => undefined }) },
        append: () => undefined,
    } as unknown as HTMLElement;
    const pipeline = new BabylonGeodesicGridPipeline(
        scene,
        labels,
        { wireframe: false, tiling: webMercatorTiling(), elevation: { pyramid }, junctionBudgetMilliseconds },
        4,
    );
    const applied = vi.spyOn(
        pipeline as unknown as { applyGeometry: (handle: IBabylonGeodesicGridHandle, lods: unknown) => void },
        "applyGeometry",
    );
    return { pipeline, applied };
}

/** Activates a tile and returns its handle, as the runtime does. */
async function activate(pipeline: BabylonGeodesicGridPipeline, address: ITileAddress): Promise<IBabylonGeodesicGridHandle> {
    let handle: IBabylonGeodesicGridHandle | undefined;
    await pipeline.activate({
        tile: {
            id: `${address.lod}/${address.x}/${address.y}`,
            source: { metadata: { class: "t", properties: { lod: address.lod, x: address.x, y: address.y } } },
        },
        pendingContents: [{ id: "c", uri: "u" }],
        signal: new AbortController().signal,
        readiness: {
            ready: async (_id: string, result: { handle: IBabylonGeodesicGridHandle }) => {
                handle = result.handle;
                return true;
            },
            failed: async (_id: string, error: unknown) => {
                throw error;
            },
            cancelled: async () => undefined,
        },
    } as never);
    return handle!;
}

const present = (pipeline: BabylonGeodesicGridPipeline, handle: IBabylonGeodesicGridHandle) =>
    pipeline.present({ resources: [{ handle, metadataHandle: handle.metadataHandle }] } as never);

describe("BabylonGeodesicGridPipeline", () => {
    afterEach(() => vi.restoreAllMocks());

    it("builds a new tile once, alone or with neighbours of its level", async () => {
        const { pipeline, applied } = createPipeline();
        const first = await activate(pipeline, { lod: 3, x: 3, y: 3 });
        expect(applied).toHaveBeenCalledTimes(1);

        present(pipeline, first);
        pipeline.updateJunctions();
        expect(applied).toHaveBeenCalledTimes(1);
        pipeline.dispose();
    });

    it("builds a tile again when the levels around it change", async () => {
        const { pipeline, applied } = createPipeline();
        const first = await activate(pipeline, { lod: 3, x: 3, y: 3 });
        present(pipeline, first);
        pipeline.updateJunctions();

        // A coarser tile to the east: the edge of the first tile adapts.
        const coarser = await activate(pipeline, { lod: 2, x: 2, y: 1 });
        const built = applied.mock.calls.length;
        present(pipeline, coarser);
        pipeline.updateJunctions();
        expect(applied.mock.calls.length).toBeGreaterThan(built);
        expect(applied.mock.calls.some(([handle]) => handle === first)).toBe(true);
        pipeline.dispose();
    });

    it("counts the scan of the tiles in its budget, and still rebuilds one per frame", async () => {
        const { pipeline, applied } = createPipeline(4);
        const handles = await Promise.all(
            [
                { lod: 3, x: 3, y: 3 },
                { lod: 3, x: 3, y: 4 },
                { lod: 3, x: 3, y: 5 },
            ].map((address) => activate(pipeline, address)),
        );
        for (const handle of handles) present(pipeline, handle);
        pipeline.updateJunctions();
        // Levels change around every tile, and the scan alone takes more than the budget.
        for (const handle of handles) handle.edgeLevels = "changed";
        (pipeline as unknown as { junctionsDirty: boolean }).junctionsDirty = true;
        applied.mockClear();

        let now = 1000;
        vi.spyOn(performance, "now").mockImplementation(() => now);
        const displayed = (pipeline as unknown as { displayed: { edgeLods: (...args: unknown[]) => unknown } }).displayed;
        const edgeLods = displayed.edgeLods.bind(displayed);
        vi.spyOn(displayed, "edgeLods").mockImplementation((...args: unknown[]) => {
            now += 10;
            return edgeLods(...args);
        });
        pipeline.updateJunctions();
        expect(applied).toHaveBeenCalledTimes(1);
        pipeline.dispose();
    });
});

// The same address on another face is another tile, in the topology the pipeline reads.
describe("tiling", () => {
    it("connects a face to its neighbours", () => {
        expect(CUBE_TILE_TOPOLOGY.neighbor({ face: 0, lod: 0, x: 0, y: 0 }, TileNeighbor.E)?.address.face).not.toBe(0);
    });
});
