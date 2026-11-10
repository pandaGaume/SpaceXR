import type { ITile } from "@spacexr/3d-tiles-core";
import type { IImplicitTileAddressContext, ITileAddress } from "@spacexr/3d-tiles-runtime";
import { describe, expect, it } from "vitest";

import { createGeodesicGridSource, TILE_METRICS } from "../src/terrain/grid-source";

/** Address context of a tile below one of the roots of the grid, in implicit coordinates, `y` northward. */
function contextOf(rootTile: ITile, root: ITileAddress, address: ITileAddress): IImplicitTileAddressContext {
    const level = address.lod - root.lod;
    const scale = 2 ** level;
    return {
        documentUri: "memory://grid/tileset.json",
        rootTile,
        implicitTiling: rootTile.implicitTiling!,
        coordinates: { level, x: address.x - root.x * scale, y: scale - 1 - (address.y - root.y * scale) },
    };
}

describe("createGeodesicGridSource subtrees", () => {
    const rootAddress = { lod: 3, x: 4, y: 2 };
    const rootIndex = rootAddress.y * 8 + rootAddress.x;

    it("registers a subtree with its own levels at its root tile", () => {
        const source = createGeodesicGridSource(undefined, { subtrees: [{ root: { lod: 5, x: 17, y: 9 }, maxLOD: 6 }] });
        const rootTile = source.tileset.root.children![rootIndex]!;

        const graft = source.resolver.subtreeAt!(contextOf(rootTile, rootAddress, { lod: 5, x: 17, y: 9 }));
        expect(graft?.tile.implicitTiling?.availableLevels).toBe(2);
        expect(graft?.resolver).toBe(source.resolver);
        // The tiles of the subtree keep the address metadata the terrain engines read.
        const resolved = source.resolver.resolve({
            documentUri: "memory://grid/tileset.json",
            rootTile: graft!.tile,
            implicitTiling: graft!.tile.implicitTiling!,
            coordinates: { level: 1, x: 0, y: 1 },
            computedBoundingVolume: graft!.tile.boundingVolume,
            computedGeometricError: 0,
            computedContents: [],
        });
        expect(resolved?.metadata?.properties).toEqual({ lod: 6, x: 34, y: 18 });
    });

    it("keeps the rules of the grid elsewhere", () => {
        const source = createGeodesicGridSource(undefined, { subtrees: [{ root: { lod: 5, x: 17, y: 9 }, maxLOD: 6 }] });
        const rootTile = source.tileset.root.children![rootIndex]!;

        expect(source.resolver.subtreeAt!(contextOf(rootTile, rootAddress, { lod: 5, x: 16, y: 9 }))).toBeUndefined();
        expect(rootTile.implicitTiling?.availableLevels).toBe(TILE_METRICS.maxLOD - TILE_METRICS.minLOD + 1);
    });

    it("replaces a root of the forest by a subtree registered there", () => {
        const source = createGeodesicGridSource(undefined, { subtrees: [{ root: rootAddress, maxLOD: 4 }] });

        expect(source.tileset.root.children![rootIndex]!.implicitTiling?.availableLevels).toBe(2);
        expect(source.tileset.root.children).toHaveLength(64);
    });

    it("rejects a subtree ending above its root", () => {
        expect(() => createGeodesicGridSource(undefined, { subtrees: [{ root: { lod: 5, x: 17, y: 9 }, maxLOD: 4 }] })).toThrow(RangeError);
    });
});
