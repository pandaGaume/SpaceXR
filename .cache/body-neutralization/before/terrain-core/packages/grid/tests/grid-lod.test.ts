import { TileNeighbor, tileNeighborAddress, type ITileAddress, type TileEdgeNeighbor } from "@spacexr/tiles";
import { describe, expect, it } from "vitest";

import { NeighborLod, gridEdgeLods, relativeNeighborLod } from "../src";

describe("relativeNeighborLod", () => {
    it("compares tile levels of detail", () => {
        expect(relativeNeighborLod(7, 6)).toBe(NeighborLod.Coarser);
        expect(relativeNeighborLod(7, 7)).toBe(NeighborLod.Same);
        expect(relativeNeighborLod(7, 8)).toBe(NeighborLod.Finer);
    });

    it("rejects unbalanced neighbours", () => {
        expect(() => relativeNeighborLod(7, 9)).toThrow(RangeError);
        expect(() => relativeNeighborLod(7, 5)).toThrow(RangeError);
    });
});

describe("gridEdgeLods", () => {
    it("derives the edge levels from the levels displayed around the tile", () => {
        const tile: ITileAddress = { lod: 5, x: 0, y: 10 };
        // Displayed levels around the tile, keyed by address at the tile level; the western side is beyond the pyramid.
        const displayed = new Map<string, number>([
            ["5/0/9", 6],
            ["5/1/10", 4],
            ["5/0/11", 5],
        ]);
        const lodAt = (edge: TileEdgeNeighbor) => {
            const neighbor = tileNeighborAddress(tile, edge);
            return neighbor ? displayed.get(`${neighbor.lod}/${neighbor.x}/${neighbor.y}`) : undefined;
        };

        expect(gridEdgeLods(tile, lodAt)).toEqual({
            [TileNeighbor.N]: NeighborLod.Finer,
            [TileNeighbor.E]: NeighborLod.Coarser,
            [TileNeighbor.S]: NeighborLod.Same,
            [TileNeighbor.W]: NeighborLod.Same,
        });
    });
});
