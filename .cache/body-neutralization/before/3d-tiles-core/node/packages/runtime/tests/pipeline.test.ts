import type { ITileset } from "@spacexr/3d-tiles-core";
import { describe, expect, it } from "vitest";

import {
    CameraChangeFlags,
    NO_METADATA,
    Tile3D,
    TileContentKind,
    TileMetadataState,
    TilePresentationState,
    TileReadinessState,
    TileRefinementMode,
    TileRuntime,
    TileSelectionState,
    type IRuntimeAdapter,
    type IRuntimeTilesetDocument,
} from "../src";

interface ICamera {
    value: number;
}

interface ISpatial {
    value: number;
}

interface IHandle {
    id: string;
}

const tileset: ITileset = {
    asset: { version: "1.1" },
    geometricError: 0,
    schema: {
        id: "Pipeline",
        classes: { Tile: { properties: { name: { type: "STRING" } } } },
    },
    root: {
        boundingVolume: { sphere: [0, 0, 0, 1] },
        geometricError: 0,
        metadata: { class: "Tile", properties: { name: "root" } },
        content: { uri: "grid://root", metadata: { class: "Tile", properties: { name: "grid" } } },
    },
};

describe("numeric tile pipeline", () => {
    it("keeps independent numeric states and starts metadata at NO_METADATA", () => {
        const document: IRuntimeTilesetDocument = {
            id: "document",
            uri: "memory://tileset.json",
            baseUri: "memory://",
            tileset,
            metadata: {
                uri: "memory://tileset.json",
                tileset,
                schema: tileset.schema!,
                diagnostics: [],
            },
        };
        const tile = new Tile3D<ICamera>({
            id: "tile",
            source: tileset.root,
            document,
            depth: 0,
            refinementMode: TileRefinementMode.Replace,
            spatial: { value: 0 },
            contents: [],
            frame: 0,
        });

        tile.selectionState = TileSelectionState.Active;
        tile.readinessState = TileReadinessState.Preparing;
        tile.presentationState = TilePresentationState.Presenting;
        tile.metadataState = TileMetadataState.Resolving;

        expect(tile.selectionState).toBe(TileSelectionState.Active);
        expect(tile.readinessState).toBe(TileReadinessState.Preparing);
        expect(tile.presentationState).toBe(TilePresentationState.Presenting);
        expect(tile.metadataState).toBe(TileMetadataState.Resolving);
        expect(tile.metadataHandle).toBe(NO_METADATA);
    });

    it("loads through activation, returns readiness, resolves metadata and presents without a legacy content adapter", async () => {
        const activated: string[] = [];
        const presented: string[] = [];
        let presentedMetadata = NO_METADATA;
        const adapter: IRuntimeAdapter<ICamera, ISpatial, IHandle, never> = {
            tilesets: { load: async () => ({ tileset }) },
            spatial: {
                derive: () => ({ value: 1 }),
                isVisible: () => true,
                screenSpaceError: () => 0,
            },
            activation: {
                activate: async (context) => {
                    activated.push(context.tile.id);
                    for (const content of context.pendingContents) {
                        await context.readiness.ready(content.id, {
                            kind: "renderable",
                            handle: { id: content.id },
                        });
                    }
                },
                deactivate: () => undefined,
            },
            presentation: {
                present: (context) => {
                    presented.push(context.tile.id);
                    presentedMetadata = context.resources[0]?.metadataHandle ?? NO_METADATA;
                },
                hide: () => undefined,
                release: () => undefined,
            },
        };
        const runtime = new TileRuntime({ id: "pipeline", uri: "memory://tileset.json", adapter });

        runtime.onCameraChanged({ value: 1 }, CameraChangeFlags.All);
        await runtime.processFrame();
        await runtime.whenIdle();

        expect(activated).toContain("pipeline/root");
        expect(presented).toContain("pipeline/root");
        expect(runtime.root?.contents[0]?.kind).toBe(TileContentKind.Renderable);
        expect(runtime.root?.readinessState).toBe(TileReadinessState.Ready);
        expect(presentedMetadata).not.toBe(NO_METADATA);
        expect(runtime.root?.metadataHandle).not.toBe(NO_METADATA);
        await runtime.dispose();
    });

    it("re-derives the tile spatial state from a bounding volume measured on its content", async () => {
        const region: ITileset = {
            asset: { version: "1.1" },
            geometricError: 0,
            root: {
                boundingVolume: { region: [0, 0, 0.1, 0.1, 0, 0] },
                geometricError: 0,
                content: { uri: "dem://root" },
            },
        };
        const derivedHeights: number[][] = [];
        const refined: string[] = [];
        const adapter: IRuntimeAdapter<ICamera, ISpatial, IHandle, never> = {
            tilesets: { load: async () => ({ tileset: region }) },
            spatial: {
                derive: (context) => {
                    const heights = context.tile.boundingVolume.region!.slice(4);
                    derivedHeights.push(heights);
                    return { value: heights[1]! };
                },
                isVisible: () => true,
                screenSpaceError: () => 0,
            },
            activation: {
                activate: async (context) => {
                    for (const content of context.pendingContents) {
                        await context.readiness.ready(content.id, {
                            kind: "renderable",
                            handle: { id: content.id },
                            tileBoundingVolume: { region: [0, 0, 0.1, 0.1, 1035, 4808] },
                        });
                    }
                },
                deactivate: () => undefined,
            },
            presentation: { present: () => undefined, hide: () => undefined, release: () => undefined },
        };
        const runtime = new TileRuntime({ id: "dem", uri: "memory://tileset.json", adapter });
        runtime.events.subscribe((event) => {
            if (event.type === "tile-bounds-refined") refined.push(event.tile.id);
        });

        runtime.onCameraChanged({ value: 1 }, CameraChangeFlags.All);
        await runtime.processFrame();
        await runtime.whenIdle();

        expect(derivedHeights).toEqual([
            [0, 0],
            [1035, 4808],
        ]);
        expect(runtime.root?.spatial).toEqual({ value: 4808 });
        expect(refined).toEqual(["dem/root"]);
        // The serialized tile keeps its declared volume.
        expect(region.root.boundingVolume.region).toEqual([0, 0, 0.1, 0.1, 0, 0]);
        await runtime.dispose();
    });
});
