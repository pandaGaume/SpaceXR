import type { ITileset } from "@spacexr/3d-tiles-core";
import { describe, expect, it } from "vitest";

import { CameraChangeFlags, TileReadinessState, TileRuntime, type IRuntimeAdapter, type ITileActivationContext } from "../src";

interface ICamera {
    /** Content URIs of the tiles outside the view. */
    hidden: ReadonlySet<string>;
}

interface ISpatial {
    name: string;
}

interface IHandle {
    id: string;
}

/** A root refined into two children with content, `grid://a` and `grid://b`. */
const tileset: ITileset = {
    asset: { version: "1.1" },
    geometricError: 100,
    root: {
        boundingVolume: { sphere: [0, 0, 0, 2] },
        geometricError: 100,
        refine: "REPLACE",
        children: [
            { boundingVolume: { sphere: [-1, 0, 0, 1] }, geometricError: 0, content: { uri: "grid://a" } },
            { boundingVolume: { sphere: [1, 0, 0, 1] }, geometricError: 0, content: { uri: "grid://b" } },
        ],
    },
};

type Activate = (context: ITileActivationContext<ISpatial, IHandle, never>) => Promise<void>;

function createRuntime(activate: Activate, maxConcurrentLoads: number) {
    const adapter: IRuntimeAdapter<ICamera, ISpatial, IHandle, never> = {
        tilesets: { load: async () => ({ tileset }) },
        spatial: {
            derive: (context) => ({ name: context.tile.content?.uri ?? "root" }),
            isVisible: (spatial, camera) => !camera.hidden.has(spatial.name),
            screenSpaceError: (context) => context.tile.geometricError,
        },
        activation: { activate, deactivate: () => undefined },
        presentation: { present: () => undefined, hide: () => undefined, release: () => undefined },
    };
    return new TileRuntime({
        id: "cancellation",
        uri: "memory://tileset.json",
        adapter,
        maxScreenSpaceError: 1,
        maxConcurrentLoads,
        preloadSiblings: false,
        coarseningDelayMilliseconds: 0,
    });
}

async function frame(runtime: TileRuntime<ICamera, ISpatial, IHandle, never>, hidden: readonly string[]): Promise<void> {
    runtime.onCameraChanged({ hidden: new Set(hidden) }, CameraChangeFlags.All);
    await runtime.processFrame();
    await new Promise((resolve) => setTimeout(resolve, 0));
}

function contentOf(runtime: TileRuntime<ICamera, ISpatial, IHandle, never>, uri: string) {
    for (const child of runtime.root?.children ?? []) for (const content of child.contents) if (content.uri === uri) return content;
    return undefined;
}

const ready = async (context: ITileActivationContext<ISpatial, IHandle, never>) => {
    for (const content of context.pendingContents)
        await context.readiness.ready(content.id, { kind: "renderable", handle: { id: content.id } });
};

describe("TileRuntime activation cancellation", () => {
    it("loads a tile again however many times leaving the view cancelled its loads", async () => {
        // Each activation of tile B waits until the camera turns away, which cancels it, five times in a row.
        let cancellations = 0;
        const runtime = createRuntime(async (context) => {
            const uri = context.pendingContents[0]?.uri;
            if (uri !== "grid://b" || cancellations >= 5) return ready(context);
            await new Promise((resolve) => context.signal.addEventListener("abort", resolve, { once: true }));
            cancellations++;
        }, 4);

        for (let turn = 0; turn < 5; turn++) {
            await frame(runtime, []);
            await frame(runtime, ["grid://b"]);
        }
        expect(cancellations).toBe(5);
        expect(contentOf(runtime, "grid://b")?.status).toBe(TileReadinessState.Cancelled);

        await frame(runtime, []);
        await runtime.whenIdle();
        expect(contentOf(runtime, "grid://b")?.status).toBe(TileReadinessState.Ready);
        await runtime.dispose();
    });

    it("loads a tile whose activation left the queue before it started", async () => {
        // A single load slot: tile A holds it while tile B waits in the queue.
        let release: () => void = () => undefined;
        const gate = new Promise<void>((resolve) => (release = resolve));
        const runtime = createRuntime(async (context) => {
            if (context.pendingContents[0]?.uri === "grid://a") await gate;
            await ready(context);
        }, 1);

        await frame(runtime, []);
        expect(contentOf(runtime, "grid://b")?.status).toBe(TileReadinessState.Queued);

        // B leaves the view while still queued, then comes back once A is loaded.
        await frame(runtime, ["grid://b"]);
        release();
        await runtime.whenIdle();
        await frame(runtime, []);
        await runtime.whenIdle();

        expect(contentOf(runtime, "grid://b")?.status).toBe(TileReadinessState.Ready);
        await runtime.dispose();
    });
});
