import { describe, expect, it } from "vitest";

import type {
    IImplicitSubtreeLoader,
    IImplicitTileResolver,
    IRuntimeAdapter,
    ISpatialDerivationContext,
    ISpatialMetric,
    ITileAddress,
} from "../src";
import { DenseImplicitSubtreeLoader, TileRuntime, WebMercatorTileMetrics, createWebMapImplicitSource } from "../src";

interface ISpatial {
    region: readonly number[];
}

/** Refines every tile: the deepest available level is selected everywhere. */
class RefineEverywhere implements ISpatialMetric<object, ISpatial> {
    public derive(context: ISpatialDerivationContext<ISpatial>): ISpatial {
        return { region: context.tile.boundingVolume.region ?? [] };
    }

    public isVisible(): boolean {
        return true;
    }

    public screenSpaceError(): number {
        return 1000;
    }
}

const same = (left: ITileAddress, right: ITileAddress): boolean => left.lod === right.lod && left.x === right.x && left.y === right.y;

/** A subtree source rooted at an address, with its own levels and content template. */
function subtreeSource(root: ITileAddress, maxLOD: number) {
    return createWebMapImplicitSource({
        id: "custom",
        urlTemplates: "custom://{z}/{x}/{y}",
        metrics: new WebMercatorTileMetrics({ minLOD: root.lod, maxLOD }),
        rootAddress: root,
        subtreeLevels: 2,
    });
}

/** Runtime over a global pyramid down to `maxLOD`, with an optional subtree registered at `graftAt`. */
async function selectedUris(
    maxLOD: number,
    graft?: { at: ITileAddress; maxLOD: number; subtrees?: IImplicitSubtreeLoader },
): Promise<string[]> {
    const base = createWebMapImplicitSource({
        urlTemplates: "base://{z}/{x}/{y}",
        metrics: new WebMercatorTileMetrics({ minLOD: 0, maxLOD }),
        subtreeLevels: 2,
    });
    const custom = graft ? subtreeSource(graft.at, graft.maxLOD) : undefined;
    const resolver: IImplicitTileResolver = {
        resolve: (context) => base.resolver.resolve(context),
        addressOf: (context) => base.resolver.addressOf(context),
        subtreeAt: (context) =>
            graft && custom && same(base.resolver.addressOf(context), graft.at)
                ? { tile: custom.tileset.root, resolver: custom.resolver, ...(graft.subtrees ? { subtrees: graft.subtrees } : {}) }
                : undefined,
    };
    const adapter: IRuntimeAdapter<object, ISpatial, string, never> = {
        tilesets: { load: async () => ({ tileset: base.tileset }) },
        subtrees: new DenseImplicitSubtreeLoader(),
        implicitTiles: resolver,
        spatial: new RefineEverywhere(),
        content: {
            load: async (context) => ({ kind: "renderable", handle: context.uri }),
            attach: () => undefined,
            detach: () => undefined,
        },
    };
    const runtime = new TileRuntime({
        id: "grafts",
        uri: "memory://grafts/tileset.json",
        adapter,
        maxScreenSpaceError: 1,
        maxConcurrentLoads: 16,
    });
    for (let frame = 0; frame < 12; frame++) {
        runtime.onCameraChanged({}, 1);
        await runtime.processFrame();
        await runtime.whenIdle();
    }
    const uris = runtime.selectedTiles.flatMap((tile) => tile.contents.map((content) => content.uri));
    await runtime.dispose();
    return uris.sort();
}

describe("implicit subtree grafts", () => {
    it("stops the refinement where a shallower subtree is registered", async () => {
        // The north-west quadrant follows a subtree that ends at level 2; the rest of the pyramid reaches level 3.
        const uris = await selectedUris(3, { at: { lod: 1, x: 0, y: 0 }, maxLOD: 2 });

        expect(uris.filter((uri) => uri.startsWith("custom://"))).toEqual([
            "custom://2/0/0",
            "custom://2/0/1",
            "custom://2/1/0",
            "custom://2/1/1",
        ]);
        expect(uris.filter((uri) => uri.startsWith("base://3/"))).toHaveLength(48);
        expect(uris.some((uri) => uri.startsWith("base://") && uri.match(/^base:\/\/3\/[0-3]\/[0-3]$/))).toBe(false);
    });

    it("goes deeper than the tileset where a deeper subtree is registered", async () => {
        const uris = await selectedUris(2, { at: { lod: 2, x: 1, y: 1 }, maxLOD: 4 });

        // 2/1/1 is replaced by its 16 descendants at level 4; the 15 other tiles of level 2 stay.
        expect(uris.filter((uri) => uri.startsWith("custom://4/"))).toHaveLength(16);
        expect(uris.filter((uri) => uri.startsWith("base://2/"))).toHaveLength(15);
        expect(uris).not.toContain("base://2/1/1");
    });

    it("loads the availability of a subtree with its own loader", async () => {
        const requested: string[] = [];
        const dense = new DenseImplicitSubtreeLoader();
        const subtrees: IImplicitSubtreeLoader = {
            load: (request) => {
                requested.push(request.uri);
                return dense.load(request);
            },
        };
        await selectedUris(2, { at: { lod: 2, x: 1, y: 1 }, maxLOD: 4, subtrees });

        // The loader of the registered subtree serves the availability files below its root.
        expect(requested.length).toBeGreaterThan(0);
        expect(requested.every((uri) => uri.includes("virtual-subtrees"))).toBe(true);
    });

    it("keeps the rules of the tileset where no subtree is registered", async () => {
        const uris = await selectedUris(3);

        expect(uris.some((uri) => uri.startsWith("custom://"))).toBe(false);
        expect(uris.filter((uri) => uri.startsWith("base://3/"))).toHaveLength(64);
    });
});
