import { TileNeighbor } from "@spacexr/tiles";
import { describe, expect, it } from "vitest";

import { NeighborLod, buildGridVertices, createGridTopology, createJunctionGridTopology } from "../src";

describe("buildGridVertices", () => {
    it("centres the grid with X eastward, Y northward and Z for heights", () => {
        const topology = createGridTopology(2);
        const data = buildGridVertices(topology, { scaleX: 10, zInitializer: ({ column, row }) => column + 10 * row });

        expect([...data.positions.slice(0, 3)]).toEqual([-5, 5, 0]);
        expect([...data.positions.slice(24, 27)]).toEqual([5, -5, 22]);
        expect(data.normals).toBeUndefined();
        expect(data.uvs).toBeUndefined();
        expect(data.indices).toEqual(topology.indices);
        expect(data.indices).not.toBe(topology.indices);
    });

    it("passes half-integer columns to the initializers on edge midpoints", () => {
        const lods = { [TileNeighbor.N]: NeighborLod.Finer, [TileNeighbor.E]: 0, [TileNeighbor.S]: 0, [TileNeighbor.W]: 0 };
        const columns: number[] = [];
        buildGridVertices(createJunctionGridTopology(2, 2, lods), {
            zInitializer: ({ column, row }) => {
                if (row === 0) columns.push(column);
                return 0;
            },
        });

        expect(columns).toEqual([0, 0.5, 1, 1.5, 2]);
    });

    it("applies scales and offsets in cells", () => {
        const data = buildGridVertices(createGridTopology(4, 2), { scaleX: 4, scaleY: 2, offsetColumns: 1, offsetRows: -1 });

        // offsetColumns shifts by a quarter of the width, offsetRows by half the height.
        expect([...data.positions.slice(0, 3)]).toEqual([-1, 0, 0]);
    });

    it("swaps Y and Z for Y-up engines and emits matching normals", () => {
        const data = buildGridVertices(createGridTopology(1), { zInitializer: () => 3, invertYZ: true, normals: true });

        expect([...data.positions.slice(0, 3)]).toEqual([-0.5, 3, 0.5]);
        expect([...data.normals!.slice(0, 3)]).toEqual([0, 1, 0]);
    });

    it("emits texture coordinates and reverses winding on request", () => {
        const topology = createGridTopology(1);
        const data = buildGridVertices(topology, { uvs: true, invertIndices: true });
        const custom = buildGridVertices(topology, { uvs: true, uvInitializer: ({ u, v }) => [u, 1 - v] });

        expect([...data.uvs!]).toEqual([0, 0, 1, 0, 0, 1, 1, 1]);
        expect([...custom.uvs!]).toEqual([0, 1, 1, 1, 0, 0, 1, 0]);
        expect([...data.indices.slice(0, 3)]).toEqual([topology.indices[0], topology.indices[2], topology.indices[1]]);
    });
});
