import { describe, expect, it } from "vitest";
import { DrapeInstanceCut, DrapeInstanceEdge } from "../src";

describe("runtime terrain connections", () => {
    const coarse = { lod: 5, x: 10, y: 10 };
    const fine = [
        { lod: 6, x: 22, y: 20 },
        { lod: 6, x: 22, y: 21 },
    ];

    it("keeps exactly the published geometry and records fine-side connections", () => {
        const instances = new DrapeInstanceCut().connectTerrain([coarse, ...fine]);
        expect(instances.map(({ address }) => address)).toEqual([coarse, ...fine]);
        expect(instances[0]!.finerEdges).toBe(DrapeInstanceEdge.E);
        expect(instances[1]!.coarserEdges).toBe(DrapeInstanceEdge.W);
        expect(instances[2]!.coarserEdges).toBe(DrapeInstanceEdge.W);
        expect(instances[1]!.edgeTerrain[3]).toEqual(coarse);
    });

    it("uses actual DEM levels for shared heights without changing geometry levels", () => {
        const instances = new DrapeInstanceCut({ terrainDataLevel: (tile) => (tile.x === 10 ? 4 : 3) }).connectTerrain([coarse, ...fine]);
        expect(instances.map(({ address }) => address.lod)).toEqual([5, 6, 6]);
        expect(instances[0]!.edgeTerrain[1]).toEqual(fine[0]);
        expect(instances[1]!.edgeTerrain[3]).toEqual(fine[0]);
    });

    it("does not repair an invalid input cut by silently adding geometry", () => {
        const deep = { lod: 8, x: 176, y: 160 };
        const instances = new DrapeInstanceCut().connectTerrain([coarse, deep]);
        expect(instances.map(({ address }) => address)).toEqual([coarse, deep]);
    });
});
