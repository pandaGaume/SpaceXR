import { TILE_EDGE_NEIGHBORS, tileNeighborAddress, type ITileAddress } from "@spacexr/tiles";
import { describe, expect, it } from "vitest";

import { completeTileCover, DrapeInstanceCut, DrapeInstanceEdge, type IDrapeInstance } from "../src";

const tile = (text: string): ITileAddress => {
    const [lod, x, y] = text.split("/").map(Number);
    return { lod: lod!, x: x!, y: y! };
};
const tiles = (...texts: string[]): ITileAddress[] => texts.map(tile);
const keys = (instances: readonly IDrapeInstance[]): string[] => instances.map(({ address }) => `${address.lod}/${address.x}/${address.y}`).sort();

/** Largest level difference across an edge between two instances. */
function largestEdgeGap(instances: readonly IDrapeInstance[]): number {
    const byKey = new Map(instances.map((instance) => [`${instance.address.lod}/${instance.address.x}/${instance.address.y}`, instance]));
    let gap = 0;
    for (const { address } of instances) {
        for (const edge of TILE_EDGE_NEIGHBORS) {
            const neighbor = tileNeighborAddress(address, edge, { wrapX: true });
            for (let levels = 0; neighbor && levels <= address.lod; levels++) {
                const scale = 2 ** levels;
                const ancestor = byKey.get(`${address.lod - levels}/${Math.floor(neighbor.x / scale)}/${Math.floor(neighbor.y / scale)}`);
                if (ancestor) {
                    gap = Math.max(gap, levels);
                    break;
                }
            }
        }
    }
    return gap;
}

describe("completeTileCover", () => {
    const roots = [0, 1].map((face) => ({ face, lod: 0, x: 0, y: 0 }));
    const area = (tile: { lod: number }): number => 4 ** -tile.lod;

    it("covers what the cut leaves, without overlap", () => {
        const cut = [{ face: 0, lod: 2, x: 1, y: 1 }];
        const fill = completeTileCover(cut, roots, () => true);
        // The other face, the three siblings of level 2 and the three siblings of their parent.
        expect(fill).toHaveLength(1 + 3 + 3);
        expect(fill).toContainEqual({ face: 1, lod: 0, x: 0, y: 0 });
        expect(fill).toContainEqual({ face: 0, lod: 1, x: 1, y: 0 });
        expect(fill).toContainEqual({ face: 0, lod: 2, x: 0, y: 0 });
        expect([...cut, ...fill].reduce((sum, tile) => sum + area(tile), 0)).toBe(roots.length);
        const keys = fill.map((tile) => `${tile.face}/${tile.lod}/${tile.x}/${tile.y}`);
        expect(new Set(keys).size).toBe(keys.length);
    });

    it("adds nothing to a complete cut", () => {
        expect(completeTileCover(roots, roots, () => true)).toEqual([]);
    });

    it("leaves uncovered what is not available", () => {
        const fill = completeTileCover([{ face: 0, lod: 1, x: 0, y: 0 }], roots, (tile) => tile.face === 0 && tile.x === 1);
        expect(fill).toEqual([
            { face: 0, lod: 1, x: 1, y: 0 },
            { face: 0, lod: 1, x: 1, y: 1 },
        ]);
    });
});

describe("DrapeInstanceCut", () => {
    it("draws a terrain tile as one instance when the imagery is not finer", () => {
        const cut = new DrapeInstanceCut();
        // Imagery as coarse as the terrain tile, and coarser.
        const instances = cut.update(tiles("5/10/10", "5/11/10"), tiles("5/10/10", "4/5/5"), 0);

        expect(keys(instances)).toEqual(["5/10/10", "5/11/10"]);
        expect(instances.every(({ coarserEdges }) => coarserEdges === 0)).toBe(true);
    });

    it("draws the imagery tiles below a terrain tile, completed to cover it", () => {
        const cut = new DrapeInstanceCut();
        // Imagery two levels below the north-west corner of the terrain tile.
        const instances = cut.update(tiles("5/10/10"), tiles("7/40/40"), 0);

        expect(keys(instances)).toEqual(["6/20/21", "6/21/20", "6/21/21", "7/40/40", "7/40/41", "7/41/40", "7/41/41"].sort());
        expect(instances.every(({ terrain }) => terrain.lod === 5 && terrain.x === 10 && terrain.y === 10)).toBe(true);
        // 7/41/40 meets the coarser 6/21/20 on its east edge, 7/40/41 the coarser 6/20/21 on its south edge.
        const edges = Object.fromEntries(instances.map((instance) => [`${instance.address.lod}/${instance.address.x}/${instance.address.y}`, instance.coarserEdges]));
        expect(edges["7/41/40"]).toBe(DrapeInstanceEdge.E);
        expect(edges["7/40/41"]).toBe(DrapeInstanceEdge.S);
        expect(edges["7/41/41"]).toBe(DrapeInstanceEdge.E | DrapeInstanceEdge.S);
        expect(edges["7/40/40"]).toBe(0);
    });

    it("splits a neighbour more than one level coarser, across terrain tiles and the antimeridian", () => {
        const cut = new DrapeInstanceCut();
        // Imagery three levels below the west edge of 3/0/3, whose west neighbour across the antimeridian is 3/7/3.
        const instances = cut.update(tiles("3/0/3", "3/7/3"), tiles("6/0/24"), 0);

        expect(largestEdgeGap(instances)).toBe(1);
        expect(instances.some(({ address }) => address.lod === 3 && address.x === 7)).toBe(false);
        expect(instances.filter(({ terrain }) => terrain.x === 7).every(({ address }) => address.lod >= 4)).toBe(true);
    });

    it("leaves a balanced cut unchanged", () => {
        const cut = new DrapeInstanceCut();
        const instances = cut.update(tiles("5/10/10", "5/11/10"), tiles("6/22/20"), 0);

        expect(keys(instances)).toEqual(["5/10/10", "6/22/20", "6/22/21", "6/23/20", "6/23/21"].sort());
        expect(largestEdgeGap(instances)).toBe(1);
    });

    it("holds a coarsened level, then drops it", () => {
        const cut = new DrapeInstanceCut({ holdMilliseconds: 500 });
        expect(cut.update(tiles("5/10/10"), tiles("6/20/20"), 0)).toHaveLength(4);

        // The imagery cut coarsens: the finer instances stay during the hold.
        expect(cut.update(tiles("5/10/10"), tiles("5/10/10"), 200)).toHaveLength(4);
        expect(cut.expiresAt).toBe(500);

        expect(keys(cut.update(tiles("5/10/10"), tiles("5/10/10"), 500))).toEqual(["5/10/10"]);
        expect(cut.expiresAt).toBeUndefined();
    });

    it("stops at the maximum depth below the terrain tile", () => {
        const cut = new DrapeInstanceCut({ maxDepth: 1 });
        const instances = cut.update(tiles("5/10/10"), tiles("8/80/80"), 0);

        expect(keys(instances)).toEqual(["6/20/20", "6/20/21", "6/21/20", "6/21/21"]);
    });

    it("reports the finer and coarser neighbours across each edge", () => {
        const cut = new DrapeInstanceCut();
        // A terrain tile and its east neighbour split into four finer terrain tiles.
        const instances = cut.update(tiles("5/10/10", "6/22/20", "6/23/20", "6/22/21", "6/23/21"), [], 0);
        const byKey = Object.fromEntries(instances.map((instance) => [`${instance.address.lod}/${instance.address.x}/${instance.address.y}`, instance]));

        expect(byKey["5/10/10"]!.finerEdges).toBe(DrapeInstanceEdge.E);
        expect(byKey["5/10/10"]!.coarserEdges).toBe(0);
        expect(byKey["6/22/20"]!.coarserEdges).toBe(DrapeInstanceEdge.W);
        expect(byKey["6/22/20"]!.finerEdges).toBe(0);
        expect(byKey["6/23/20"]!.coarserEdges | byKey["6/23/20"]!.finerEdges).toBe(0);
    });

    it("reads the heights of each edge and corner from the coarsest terrain tile touching it", () => {
        const cut = new DrapeInstanceCut();
        const instances = cut.update(tiles("5/10/10", "6/22/20", "6/23/20", "6/22/21", "6/23/21"), [], 0);
        const fine = instances.find(({ address }) => address.lod === 6 && address.x === 22 && address.y === 20)!;
        const coarse = { lod: 5, x: 10, y: 10 };
        const own = { lod: 6, x: 22, y: 20 };

        // N, E, S, W: only the west edge touches the coarser terrain tile.
        expect(fine.edgeTerrain).toEqual([own, own, own, coarse]);
        // NW, NE, SE, SW: the two western corners lie on the coarser tile.
        expect(fine.cornerTerrain).toEqual([coarse, own, own, coarse]);

        const coarseInstance = instances.find(({ address }) => address.lod === 5)!;
        expect(coarseInstance.edgeTerrain).toEqual([coarse, coarse, coarse, coarse]);
    });

    it("finds a corner neighbour two levels finer across a diagonal", () => {
        const cut = new DrapeInstanceCut();
        // 7/43/39 touches the north-east corner of 5/10/10 (point 11/10 at level 5) through the diagonal only.
        const instances = cut.update(tiles("5/10/10", "5/11/9"), tiles("7/44/39"), 0);
        const coarse = instances.find(({ address }) => address.lod === 5 && address.x === 10)!;

        expect(coarse.cornerTerrain[1]).toEqual({ lod: 5, x: 10, y: 10 });
        expect(instances.some(({ address }) => address.lod === 7 && address.x === 44 && address.y === 39)).toBe(true);
    });

    it("rejects a negative maximum depth", () => {
        expect(() => new DrapeInstanceCut({ maxDepth: -1 })).toThrow(RangeError);
    });
});
