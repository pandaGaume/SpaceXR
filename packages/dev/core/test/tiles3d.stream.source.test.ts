import { ICameraViewState } from "../src/camera";
import { Nullable } from "../src/types";
import { ITile3d, ITileset } from "../src/tiles/3d/interfaces";
import { ITilesetLoader, Tile3dStreamSource, TileContentStatus } from "../src/tiles/3d/engine";

const VIEW = "main";

function camera(distance: number): ICameraViewState {
    return {
        worldPosition: { x: 0, y: 0, z: distance },
        worldRotation: { x: 0, y: 0, z: 0, w: 1 },
        fovY: Math.PI / 2,
        tanFov2: 1,
        viewportHeight: 1080,
    };
}

function flush(): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, 0));
}

interface TileSpec {
    geometricError: number;
    sphere?: [number, number, number, number];
    refine?: string;
    contentUri?: string;
    children?: TileSpec[];
}

function makeTile(spec: TileSpec): ITile3d {
    return {
        geometricError: spec.geometricError,
        boundingVolume: { sphere: spec.sphere ?? [0, 0, 0, 100] },
        refine: spec.refine,
        content: spec.contentUri ? { uri: spec.contentUri } : undefined,
        children: spec.children?.length ? (spec.children.map(makeTile) as [ITile3d, ...ITile3d[]]) : undefined,
    } as ITile3d;
}

function makeLoader(tilesets: Record<string, TileSpec>): ITilesetLoader {
    return {
        loadTileSetAsync: async (uri: string): Promise<Nullable<ITileset>> => {
            const spec = tilesets[uri];
            if (!spec) return null;
            return { asset: { version: "1.1" }, geometricError: spec.geometricError, root: makeTile(spec) } as ITileset;
        },
    };
}

function makeSource(tilesets: Record<string, TileSpec>, refine = "REPLACE"): Tile3dStreamSource {
    void refine;
    return new Tile3dStreamSource({
        id: "t",
        uri: "http://x/tileset.json",
        tilesetLoader: makeLoader(tilesets),
        maxScreenSpaceError: 16,
        horizonCull: false,
    });
}

/**
 * Root (content root.glb, ge 200) with two leaf children (a.glb / b.glb, ge 50).
 * With tanFov2 = 1 and viewport 1080: sse(root) = 200*1080 / (2*(d-100)).
 * Far (d = 100 000): sse ~ 1 -> root only. Near (d = 1 100): sse ~ 108 -> refine.
 */
function simpleTileset(refine: string): Record<string, TileSpec> {
    return {
        "http://x/tileset.json": {
            geometricError: 200,
            refine,
            contentUri: "root.glb",
            children: [
                { geometricError: 50, sphere: [-50, 0, 0, 50], contentUri: "a.glb" },
                { geometricError: 50, sphere: [50, 0, 0, 50], contentUri: "b.glb" },
            ],
        },
    };
}

describe("Tile3dStreamSource", () => {
    it("lazily loads the root and emits it when SSE is under budget", async () => {
        const source = makeSource(simpleTileset("REPLACE"));
        source.setContext(VIEW, camera(100_000));
        await flush();
        const cut = source.getActiveSources(VIEW)!;
        expect(cut.size).toBe(1);
        expect(cut.has("t")).toBe(true);
    });

    it("REPLACE refinement is hole-free: parent stays until every child is fetched, then swaps atomically", async () => {
        const source = makeSource(simpleTileset("REPLACE"));
        source.setContext(VIEW, camera(100_000));
        await flush();

        // Approach: refinement wanted, children not loaded -> parent + gated children.
        source.setContext(VIEW, camera(1_100));
        let cut = source.getActiveSources(VIEW)!;
        expect(cut.size).toBe(3);
        expect(cut.has("t")).toBe(true);
        const children = Array.from(cut.values()).filter((s) => s.id !== "t");
        for (const c of children) {
            expect((c.content as ITile3d).renderable).toBe(false);
        }

        // One child ready: still gated (sibling incomplete).
        (children[0].content as ITile3d).contentStatus = TileContentStatus.ready;
        source.invalidate();
        cut = source.getActiveSources(VIEW)!;
        expect(cut.has("t")).toBe(true);
        expect((children[0].content as ITile3d).renderable).toBe(false);

        // All children ready: atomic swap, parent out, gates open.
        (children[1].content as ITile3d).contentStatus = TileContentStatus.ready;
        source.invalidate();
        cut = source.getActiveSources(VIEW)!;
        expect(cut.size).toBe(2);
        expect(cut.has("t")).toBe(false);
        for (const c of children) {
            expect((c.content as ITile3d).renderable).toBe(true);
        }
    });

    it("coarsens back to the parent when the camera retreats", async () => {
        const source = makeSource(simpleTileset("REPLACE"));
        source.setContext(VIEW, camera(100_000));
        await flush();
        source.setContext(VIEW, camera(1_100));
        const cut1 = source.getActiveSources(VIEW)!;
        for (const s of cut1.values()) {
            (s.content as ITile3d).contentStatus = TileContentStatus.ready;
        }
        source.invalidate();
        expect(source.getActiveSources(VIEW)!.has("t")).toBe(false);

        // Retreat: children leave the cut, the parent returns.
        source.setContext(VIEW, camera(100_000));
        const cut2 = source.getActiveSources(VIEW)!;
        expect(cut2.size).toBe(1);
        expect(cut2.has("t")).toBe(true);
    });

    it("ADD refinement keeps parent and children in the cut together", async () => {
        const source = makeSource(simpleTileset("ADD"));
        source.setContext(VIEW, camera(100_000));
        await flush();
        source.setContext(VIEW, camera(1_100));
        const cut = source.getActiveSources(VIEW)!;
        expect(cut.size).toBe(3);
        expect(cut.has("t")).toBe(true);
        for (const s of cut.values()) {
            expect((s.content as ITile3d).renderable).toBe(true);
        }
    });

    it("grafts external tilesets on demand and traverses into them", async () => {
        const source = makeSource({
            "http://x/tileset.json": {
                geometricError: 200,
                refine: "REPLACE",
                children: [{ geometricError: 100, contentUri: "sub/tileset.json" }],
            },
            "http://x/sub/tileset.json": {
                geometricError: 100,
                refine: "REPLACE",
                contentUri: "leaf.glb",
            },
        });
        source.setContext(VIEW, camera(1_100));
        await flush(); // root document
        await flush(); // external graft
        source.invalidate();
        const cut = source.getActiveSources(VIEW)!;
        // grafted sub-root: uid t/0/0 (root -> external tile -> sub root)
        expect(cut.has("t/0/0")).toBe(true);
        const leaf = cut.get("t/0/0")! as unknown as { content: ITile3d };
        expect(leaf.content.contents?.[0].uri).toBe("http://x/sub/leaf.glb");
    });

    it("closes the render gate when a tile leaves the cut (no ghost geometry on late loads)", async () => {
        const source = makeSource(simpleTileset("REPLACE"));
        source.setContext(VIEW, camera(100_000));
        await flush();

        // Refine: children enter the cut, one of them finishes loading and renders.
        source.setContext(VIEW, camera(1_100));
        const children = Array.from(source.getActiveSources(VIEW)!.values()).filter((s) => s.id !== "t");
        for (const c of children) {
            (c.content as ITile3d).contentStatus = TileContentStatus.ready;
        }
        source.invalidate();
        expect((children[0].content as ITile3d).renderable).toBe(true);

        // Retreat: the children leave the cut. Their gate must close, otherwise a
        // load settling afterwards would be presented and never removed.
        source.setContext(VIEW, camera(100_000));
        for (const c of children) {
            expect((c.content as ITile3d).renderable).toBe(false);
        }
    });

    it("holds the swap back when a child fails to load, so the parent keeps covering the area", async () => {
        const source = makeSource(simpleTileset("REPLACE"));
        source.setContext(VIEW, camera(100_000));
        await flush();
        source.setContext(VIEW, camera(1_100));
        const children = Array.from(source.getActiveSources(VIEW)!.values()).filter((s) => s.id !== "t");

        (children[0].content as ITile3d).contentStatus = TileContentStatus.ready;
        (children[1].content as ITile3d).contentStatus = TileContentStatus.error;
        source.invalidate();

        // No hole: the parent stays in the cut and keeps rendering.
        const cut = source.getActiveSources(VIEW)!;
        expect(cut.has("t")).toBe(true);
        expect((cut.get("t")!.content as ITile3d).renderable).toBe(true);
    });

    it("retries the root tileset after a transient failure", async () => {
        let attempts = 0;
        const source = new Tile3dStreamSource({
            id: "t",
            uri: "http://x/tileset.json",
            horizonCull: false,
            tilesetLoader: {
                loadTileSetAsync: async () => {
                    attempts++;
                    if (attempts === 1) throw new Error("network blip");
                    return { asset: { version: "1.1" }, geometricError: 200, root: makeTile({ geometricError: 200, contentUri: "root.glb" }) } as ITileset;
                },
            },
        });

        source.setContext(VIEW, camera(100_000));
        await flush();
        expect(source.getActiveSources(VIEW)!.size).toBe(0);

        // A later frame retries instead of staying bricked forever.
        source.setContext(VIEW, camera(100_000));
        await flush();
        expect(attempts).toBe(2);
        expect(source.getActiveSources(VIEW)!.has("t")).toBe(true);
    });

    it("reports pending work while budgeted refines are still queued", async () => {
        const source = new Tile3dStreamSource({
            id: "t",
            uri: "http://x/tileset.json",
            horizonCull: false,
            maxRefinePerFrame: 1,
            tilesetLoader: makeLoader(simpleTileset("ADD")),
        });
        source.setContext(VIEW, camera(100_000));
        await flush();
        source.setContext(VIEW, camera(1_100));
        // 3 tiles wanted, 1 activated per frame: convergence is not finished.
        expect(source.hasPendingWork).toBe(true);
        source.setContext(VIEW, camera(1_100));
        source.setContext(VIEW, camera(1_100));
        expect(source.getActiveSources(VIEW)!.size).toBe(3);
        expect(source.hasPendingWork).toBe(false);
    });

    it("carries the screen-space error into the load priority", async () => {
        const source = makeSource(simpleTileset("ADD"));
        source.setContext(VIEW, camera(100_000));
        await flush();
        source.setContext(VIEW, camera(1_100));
        const root = source.getActiveSources(VIEW)!.get("t")!.content as ITile3d;
        // sse ~ 108 px at this distance, clamped into the priority range.
        expect(root.priority).toBeGreaterThan(50);
        expect(root.priority).toBeLessThanOrEqual(100);
    });

    it("inherits the refine mode from the parent when unspecified", async () => {
        const source = makeSource({
            "http://x/tileset.json": {
                geometricError: 200,
                refine: "ADD",
                contentUri: "root.glb",
                children: [{ geometricError: 50, contentUri: "a.glb", children: [{ geometricError: 10, contentUri: "aa.glb" }] }],
            },
        });
        source.setContext(VIEW, camera(500));
        await flush();
        const cut = source.getActiveSources(VIEW)!;
        // ADD inherited by every level: all three tiles accumulate.
        expect(cut.size).toBe(3);
    });
});
