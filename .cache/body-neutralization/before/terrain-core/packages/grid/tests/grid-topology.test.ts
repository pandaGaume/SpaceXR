import { TILE_CORNER_NEIGHBORS, TILE_EDGE_NEIGHBORS, TileNeighbor, type TileEdgeNeighbor } from "@spacexr/tiles";
import { describe, expect, it } from "vitest";

import {
    GridJunctionPieces,
    JunctionGridTopologyCache,
    NEIGHBOR_LODS,
    NeighborLod,
    SAME_EDGE_LODS,
    createGridTopology,
    createJunctionGridTopology,
    edgeLodsKey,
    type GridEdgeLods,
    type IGridTopology,
} from "../src";

type Point = [number, number];

function vertex(topology: IGridTopology, index: number): Point {
    return [topology.coordinates[index * 2]!, topology.coordinates[index * 2 + 1]!];
}

function triangles(topology: IGridTopology): Array<[Point, Point, Point]> {
    const result: Array<[Point, Point, Point]> = [];
    for (let offset = 0; offset < topology.indices.length; offset += 3) {
        result.push([vertex(topology, topology.indices[offset]!), vertex(topology, topology.indices[offset + 1]!), vertex(topology, topology.indices[offset + 2]!)]);
    }
    return result;
}

function signedArea([a, b, c]: [Point, Point, Point]): number {
    return ((b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0])) / 2;
}

function onBoundary(a: Point, b: Point): boolean {
    return (a[0] === b[0] && (a[0] === 0 || a[0] === 1)) || (a[1] === b[1] && (a[1] === 0 || a[1] === 1));
}

/** Asserts that the triangles tile the unit square: same winding, total area 1 and a manifold disk. */
function expectTiling(topology: IGridTopology): void {
    const list = triangles(topology);
    let area = 0;
    const directed = new Map<string, number>();
    const key = (a: Point, b: Point) => `${a[0]},${a[1]}>${b[0]},${b[1]}`;
    for (const triangle of list) {
        const triangleArea = signedArea(triangle);
        expect(triangleArea).toBeLessThan(0);
        area -= triangleArea;
        for (let side = 0; side < 3; side++) {
            const edge = key(triangle[side]!, triangle[(side + 1) % 3]!);
            directed.set(edge, (directed.get(edge) ?? 0) + 1);
        }
    }
    expect(area).toBeCloseTo(1, 6);
    for (const triangle of list) {
        for (let side = 0; side < 3; side++) {
            const a = triangle[side]!;
            const b = triangle[(side + 1) % 3]!;
            expect(directed.get(key(a, b))).toBe(1);
            // Every side is shared by a neighbouring triangle in the opposite direction, except on the tile boundary.
            if (!onBoundary(a, b)) expect(directed.get(key(b, a))).toBe(1);
            else expect(directed.has(key(b, a))).toBe(false);
        }
    }
}

/** Positions along the edge, in `[0, 1]`, of the vertices used on that tile edge. */
function edgeVertices(topology: IGridTopology, edge: TileEdgeNeighbor): number[] {
    const used = new Set<number>();
    for (const index of topology.indices) {
        const [u, v] = vertex(topology, index);
        if (edge === TileNeighbor.N && v === 0) used.add(u);
        if (edge === TileNeighbor.S && v === 1) used.add(u);
        if (edge === TileNeighbor.W && u === 0) used.add(v);
        if (edge === TileNeighbor.E && u === 1) used.add(v);
    }
    return [...used].sort((left, right) => left - right);
}

function range(count: number): number[] {
    return Array.from({ length: count + 1 }, (_, index) => index / count);
}

function lodsOf(north: NeighborLod, east: NeighborLod, south: NeighborLod, west: NeighborLod): GridEdgeLods {
    return { [TileNeighbor.N]: north, [TileNeighbor.E]: east, [TileNeighbor.S]: south, [TileNeighbor.W]: west };
}

function allEdgeLods(): GridEdgeLods[] {
    const result: GridEdgeLods[] = [];
    for (const north of NEIGHBOR_LODS)
        for (const east of NEIGHBOR_LODS) for (const south of NEIGHBOR_LODS) for (const west of NEIGHBOR_LODS) result.push(lodsOf(north, east, south, west));
    return result;
}

function triangleSet(topologies: readonly IGridTopology[]): string[] {
    return topologies
        .flatMap((topology) => triangles(topology))
        .map((triangle) =>
            triangle
                .map(([u, v]) => `${u.toFixed(6)},${v.toFixed(6)}`)
                .sort()
                .join(" ")
        )
        .sort();
}

describe("createGridTopology", () => {
    it("builds a regular grid of counter-clockwise triangles", () => {
        const topology = createGridTopology(4, 3);

        expect(topology.coordinates.length / 2).toBe(20);
        expect(topology.indices.length / 3).toBe(24);
        expect(vertex(topology, 0)).toEqual([0, 0]);
        expect(vertex(topology, 19)).toEqual([1, 1]);
        expectTiling(topology);
    });

    it("alternates diagonals so that even vertices carry eight triangles and odd vertices four", () => {
        const columns = 4;
        const rows = 4;
        const topology = createGridTopology(columns, rows);
        const valence = new Map<string, number>();
        for (const triangle of triangles(topology)) {
            for (const [u, v] of triangle) valence.set(`${u * columns},${v * rows}`, (valence.get(`${u * columns},${v * rows}`) ?? 0) + 1);
            for (let side = 0; side < 3; side++) {
                const [a, b] = [triangle[side]!, triangle[(side + 1) % 3]!];
                // Diagonals join vertices whose column + row is even, as in the SpaceXR terrain grid.
                if (a[0] !== b[0] && a[1] !== b[1]) expect((a[0] * columns + a[1] * rows) % 2).toBe(0);
            }
        }
        expect(valence.get("2,2")).toBe(8);
        expect(valence.get("1,2")).toBe(4);
        expect(valence.get("2,1")).toBe(4);
        expect(valence.get("1,1")).toBe(8);
    });

    it("rejects invalid sizes", () => {
        expect(() => createGridTopology(0)).toThrow(RangeError);
        expect(() => createGridTopology(2.5)).toThrow(RangeError);
    });
});

describe("createJunctionGridTopology", () => {
    it.each([
        [4, 4],
        [6, 4],
        [2, 2],
    ])("tiles the square for every combination of edge levels on a %ix%i grid", (columns, rows) => {
        for (const lods of allEdgeLods()) {
            const topology = createJunctionGridTopology(columns, rows, lods);
            expectTiling(topology);
            for (const edge of TILE_EDGE_NEIGHBORS) {
                const segments = edge === TileNeighbor.N || edge === TileNeighbor.S ? columns : rows;
                const count = lods[edge] === NeighborLod.Finer ? 2 * segments : lods[edge] === NeighborLod.Coarser ? segments / 2 : segments;
                expect(edgeVertices(topology, edge).map((value) => value.toFixed(6))).toEqual(range(count).map((value) => value.toFixed(6)));
            }
        }
    });

    it("matches the edge of two finer neighbours when the coarse tile adapts", () => {
        const coarse = createJunctionGridTopology(4, 4, lodsOf(0, NeighborLod.Finer, 0, 0));
        const fine = createJunctionGridTopology(4, 4);

        // The two finer neighbours cover the northern and southern halves of the shared edge.
        const fineEdge = [...edgeVertices(fine, TileNeighbor.W).map((v) => v / 2), ...edgeVertices(fine, TileNeighbor.W).map((v) => 0.5 + v / 2)];
        expect(edgeVertices(coarse, TileNeighbor.E)).toEqual([...new Set(fineEdge)].sort((left, right) => left - right));
    });

    it("matches the edge of a coarser neighbour when the fine tile adapts", () => {
        const coarse = createJunctionGridTopology(4, 4);
        const fine = createJunctionGridTopology(4, 4, lodsOf(0, 0, 0, NeighborLod.Coarser));

        const coarseNorthHalf = edgeVertices(coarse, TileNeighbor.E).filter((v) => v <= 0.5);
        expect(edgeVertices(fine, TileNeighbor.W).map((v) => v / 2)).toEqual(coarseNorthHalf);
    });

    it("supports finer neighbours on odd sizes", () => {
        for (const north of [NeighborLod.Same, NeighborLod.Finer]) {
            for (const east of [NeighborLod.Same, NeighborLod.Finer]) {
                const topology = createJunctionGridTopology(3, 5, lodsOf(north, east, NeighborLod.Finer, NeighborLod.Same));
                expectTiling(topology);
                expect(edgeVertices(topology, TileNeighbor.S)).toHaveLength(7);
            }
        }
    });

    it("requires even columns and rows for a coarser neighbour", () => {
        expect(() => createJunctionGridTopology(5, 4, lodsOf(NeighborLod.Coarser, 0, 0, 0))).toThrow(RangeError);
        expect(() => createJunctionGridTopology(5, 4, lodsOf(0, NeighborLod.Coarser, 0, 0))).toThrow(RangeError);
        expect(() => createJunctionGridTopology(4, 6, lodsOf(0, NeighborLod.Coarser, 0, 0))).not.toThrow();
        expect(() => createJunctionGridTopology(1, 4)).toThrow(RangeError);
    });
});

describe("JunctionGridTopologyCache", () => {
    it("builds each variant once", () => {
        const cache = new JunctionGridTopologyCache(4);
        const lods = lodsOf(NeighborLod.Finer, 0, NeighborLod.Coarser, 0);

        expect(cache.get(lods)).toBe(cache.get({ ...lods }));
        expect(cache.get(lods)).not.toBe(cache.get());
    });

    it("keys the 81 combinations densely", () => {
        expect(new Set(allEdgeLods().map(edgeLodsKey))).toEqual(new Set(Array.from({ length: 81 }, (_, index) => index)));
        expect(edgeLodsKey(SAME_EDGE_LODS)).toBe(40);
    });
});

describe("GridJunctionPieces", () => {
    it.each([
        [4, 4],
        [8, 6],
    ])("covers exactly the single grid with nine pieces on a %ix%i grid", (columns, rows) => {
        const pieces = new GridJunctionPieces(columns, rows);
        for (const lods of allEdgeLods()) {
            const selection = pieces.select(lods);

            expect(selection).toHaveLength(9);
            expect(triangleSet(selection)).toEqual(triangleSet([createJunctionGridTopology(columns, rows, lods)]));
            for (const corner of TILE_CORNER_NEIGHBORS) expect(selection[corner]!.indices.length).toBe(6);
        }
    });

    it("places the pieces like the tile neighbour layout", () => {
        const pieces = new GridJunctionPieces(4);
        const lods = lodsOf(NeighborLod.Finer, NeighborLod.Coarser, 0, NeighborLod.Finer);
        const selection = pieces.select(lods);

        expect(selection[TileNeighbor.C]).toBe(pieces.interior);
        expect(selection[TileNeighbor.N]).toBe(pieces.edge(TileNeighbor.N, NeighborLod.Finer));
        expect(selection[TileNeighbor.NE]).toBe(pieces.corner(TileNeighbor.NE, lods));
        expect(edgeVertices(selection[TileNeighbor.N]!, TileNeighbor.N)).toEqual([0.125, 0.25, 0.375, 0.5, 0.625, 0.75, 0.875]);
    });

    it("requires even sizes of at least four segments", () => {
        expect(() => new GridJunctionPieces(2)).toThrow(RangeError);
        expect(() => new GridJunctionPieces(6, 5)).toThrow(RangeError);
    });
});
