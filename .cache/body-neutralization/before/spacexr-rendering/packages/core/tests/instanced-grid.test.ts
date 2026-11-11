import { createGridTopology } from "@spacexr/grid";
import { describe, expect, it } from "vitest";

import { refinedGridTopology } from "../src/terrain/gpu/instanced-grid";

describe("refinedGridTopology", () => {
    it("adds a vertex in the middle of every cell side of the four edges, and nowhere else", () => {
        const cells = 4;
        const refined = refinedGridTopology(cells);
        const plain = createGridTopology(cells);

        // 25 lattice vertices and 4 midpoints per edge.
        expect(refined.coordinates.length / 2).toBe(plain.coordinates.length / 2 + 4 * cells);
        const midpoints: [number, number][] = [];
        for (let vertex = 0; vertex < refined.coordinates.length / 2; vertex++) {
            const u = refined.coordinates[vertex * 2]! * cells;
            const v = refined.coordinates[vertex * 2 + 1]! * cells;
            if (Number.isInteger(u) && Number.isInteger(v)) continue;
            midpoints.push([u, v]);
        }
        expect(midpoints).toHaveLength(4 * cells);
        // Every midpoint lies on an edge, half a cell from the lattice.
        for (const [u, v] of midpoints) {
            expect(u === 0 || u === cells || v === 0 || v === cells).toBe(true);
            expect((u * 2) % 2 === 1 || (v * 2) % 2 === 1).toBe(true);
        }
    });

    it("covers the tile with triangles of the same total area as the plain grid", () => {
        const area = (topology: ReturnType<typeof createGridTopology>): number => {
            let total = 0;
            const { coordinates: c, indices: i } = topology;
            for (let t = 0; t < i.length; t += 3) {
                const [a, b, d] = [i[t]! * 2, i[t + 1]! * 2, i[t + 2]! * 2];
                total += Math.abs((c[b]! - c[a]!) * (c[d + 1]! - c[a + 1]!) - (c[d]! - c[a]!) * (c[b + 1]! - c[a + 1]!)) / 2;
            }
            return total;
        };
        expect(area(refinedGridTopology(8))).toBeCloseTo(1, 6);
    });
});
