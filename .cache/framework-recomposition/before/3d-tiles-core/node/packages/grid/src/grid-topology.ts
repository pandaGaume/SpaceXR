import { TILE_CORNER_EDGES, TILE_CORNER_NEIGHBORS, TILE_EDGE_NEIGHBORS, TileNeighbor, type TileCornerNeighbor, type TileEdgeNeighbor } from "@spacexr/tiles";

import { NEIGHBOR_LODS, NeighborLod, SAME_EDGE_LODS, edgeLodsKey, type GridEdgeLods } from "./grid-lod";

/**
 * Renderer-neutral triangle topology over a normalized tile.
 *
 * Coordinates contain no Cartesian position: `u` runs west to east and `v` north to south, both in `[0, 1]`, so the
 * same topology can be projected onto any region, ellipsoid or plane. Triangles are counter-clockwise when seen
 * from above, with east to the right and north up.
 */
export interface IGridTopology {
    /** Segments along `u`. */
    readonly columns: number;
    /** Segments along `v`. */
    readonly rows: number;
    /** `u, v` pairs. */
    readonly coordinates: Float32Array;
    /** Vertex indices, three per triangle. */
    readonly indices: Uint32Array;
}

/** Point on the half-cell lattice: `u = U / (2 * columns)` and `v = V / (2 * rows)`. */
type LatticePoint = readonly [number, number];
type Triangle = readonly [LatticePoint, LatticePoint, LatticePoint];

/**
 * The nine pieces of the junction grid that cover the tile together, indexed by {@link TileNeighbor}: the interior
 * at `TileNeighbor.C`, the edge bands at `N`, `E`, `S` and `W`, and the corner pieces at `NW`, `NE`, `SE` and `SW`.
 */
export type GridJunctionSelection = readonly IGridTopology[];

function assertSegments(name: string, value: number, minimum: number): void {
    if (!Number.isInteger(value) || value < minimum) throw new RangeError(`Grid ${name} must be an integer of at least ${minimum}.`);
}

function assertEdgeLod(edge: TileEdgeNeighbor, lod: NeighborLod, columns: number, rows: number): void {
    if (lod !== NeighborLod.Coarser && lod !== NeighborLod.Same && lod !== NeighborLod.Finer) {
        throw new RangeError(`The ${TileNeighbor[edge]} neighbour level must be -1, 0 or 1.`);
    }
    // With even sizes every corner carries diagonals, so the vertices removed for a coarser neighbour are the odd ones.
    if (lod === NeighborLod.Coarser && (columns % 2 !== 0 || rows % 2 !== 0)) {
        throw new RangeError(`A coarser ${TileNeighbor[edge]} neighbour requires even columns and rows.`);
    }
}

/** Twice the signed area in `u` east, `v` south axes. Negative is counter-clockwise seen from above with north up. */
function signedArea(a: LatticePoint, b: LatticePoint, c: LatticePoint): number {
    return (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
}

function oriented(a: LatticePoint, b: LatticePoint, c: LatticePoint): Triangle {
    return signedArea(a, b, c) <= 0 ? [a, b, c] : [a, c, b];
}

function compact(columns: number, rows: number, triangles: readonly Triangle[]): IGridTopology {
    const latticeWidth = 2 * columns + 1;
    const keys = new Set<number>();
    for (const triangle of triangles) for (const [u, v] of triangle) keys.add(v * latticeWidth + u);
    // Row-major vertex order keeps the layout deterministic across implementations.
    const ordered = [...keys].sort((left, right) => left - right);
    const vertexOf = new Map<number, number>();
    const coordinates = new Float32Array(ordered.length * 2);
    ordered.forEach((key, vertex) => {
        vertexOf.set(key, vertex);
        coordinates[vertex * 2] = (key % latticeWidth) / (2 * columns);
        coordinates[vertex * 2 + 1] = Math.floor(key / latticeWidth) / (2 * rows);
    });
    const indices = new Uint32Array(triangles.length * 3);
    let offset = 0;
    for (const triangle of triangles) for (const [u, v] of triangle) indices[offset++] = vertexOf.get(v * latticeWidth + u)!;
    return { columns, rows, coordinates, indices };
}

/**
 * Splits a cell along an alternating diagonal, as the SpaceXR terrain grid does: north-west to south-east when
 * `column + row` is even, north-east to south-west otherwise. Diagonals then only join vertices whose
 * `column + row` is even, which carry eight triangles; the other vertices carry four.
 */
function cellTriangles(column: number, row: number): Triangle[] {
    const northWest: LatticePoint = [2 * column, 2 * row];
    const northEast: LatticePoint = [2 * column + 2, 2 * row];
    const southWest: LatticePoint = [2 * column, 2 * row + 2];
    const southEast: LatticePoint = [2 * column + 2, 2 * row + 2];
    return (column + row) % 2 === 0
        ? [oriented(northWest, southEast, southWest), oriented(northWest, northEast, southEast)]
        : [oriented(northWest, northEast, southWest), oriented(southWest, northEast, southEast)];
}

function regularTriangles(columns: number, rows: number): Triangle[] {
    const triangles: Triangle[] = [];
    for (let row = 0; row < rows; row++) for (let column = 0; column < columns; column++) triangles.push(...cellTriangles(column, row));
    return triangles;
}

/** Vertices of an edge, from its north or west end, in lattice units. */
function edgeVertices(edge: TileEdgeNeighbor, columns: number, rows: number): LatticePoint[] {
    const vertices: LatticePoint[] = [];
    const count = edge === TileNeighbor.N || edge === TileNeighbor.S ? columns : rows;
    for (let index = 0; index <= count; index++) {
        if (edge === TileNeighbor.N) vertices.push([2 * index, 0]);
        else if (edge === TileNeighbor.S) vertices.push([2 * index, 2 * rows]);
        else if (edge === TileNeighbor.W) vertices.push([0, 2 * index]);
        else vertices.push([2 * columns, 2 * index]);
    }
    return vertices;
}

function pointKey([u, v]: LatticePoint): string {
    return `${u},${v}`;
}

function segmentKey(a: LatticePoint, b: LatticePoint): string {
    const first = pointKey(a);
    const second = pointKey(b);
    return first < second ? `${first}|${second}` : `${second}|${first}`;
}

/** Vertex of the triangle opposite to the segment `a, b`. */
function apex(triangle: Triangle, a: LatticePoint, b: LatticePoint): LatticePoint {
    return triangle.find((point) => pointKey(point) !== pointKey(a) && pointKey(point) !== pointKey(b))!;
}

/**
 * Adapts the triangles along one edge. Every edge segment belongs to exactly one triangle: a finer neighbour splits
 * it at the segment midpoint, and a coarser neighbour merges the two triangles around each odd edge vertex, which
 * share the same inner vertex.
 */
function adaptEdge(triangles: Triangle[], edge: TileEdgeNeighbor, lod: NeighborLod, columns: number, rows: number): Triangle[] {
    if (lod === NeighborLod.Same) return triangles;
    const owner = new Map<string, number>();
    triangles.forEach((triangle, index) => {
        for (let side = 0; side < 3; side++) owner.set(segmentKey(triangle[side]!, triangle[(side + 1) % 3]!), index);
    });
    const vertices = edgeVertices(edge, columns, rows);
    const removed = new Set<number>();
    const added: Triangle[] = [];
    const step = lod === NeighborLod.Finer ? 1 : 2;
    for (let index = 0; index + step < vertices.length; index += step) {
        const start = vertices[index]!;
        if (lod === NeighborLod.Finer) {
            const end = vertices[index + 1]!;
            const triangleIndex = owner.get(segmentKey(start, end))!;
            const inner = apex(triangles[triangleIndex]!, start, end);
            const middle: LatticePoint = [(start[0] + end[0]) / 2, (start[1] + end[1]) / 2];
            removed.add(triangleIndex);
            added.push(oriented(start, middle, inner), oriented(middle, end, inner));
        } else {
            const middle = vertices[index + 1]!;
            const end = vertices[index + 2]!;
            const first = owner.get(segmentKey(start, middle))!;
            const second = owner.get(segmentKey(middle, end))!;
            const inner = apex(triangles[first]!, start, middle);
            if (pointKey(inner) !== pointKey(apex(triangles[second]!, middle, end))) throw new Error("The grid is not alternating.");
            removed.add(first);
            removed.add(second);
            added.push(oriented(start, end, inner));
        }
    }
    return [...triangles.filter((_, index) => !removed.has(index)), ...added];
}

function junctionTriangles(columns: number, rows: number, lods: GridEdgeLods): Triangle[] {
    let triangles = regularTriangles(columns, rows);
    for (const edge of TILE_EDGE_NEIGHBORS) triangles = adaptEdge(triangles, edge, lods[edge], columns, rows);
    return triangles;
}

/** Creates a regular grid of `columns` by `rows` cells with alternating diagonals. */
export function createGridTopology(columns: number, rows: number = columns): IGridTopology {
    assertSegments("columns", columns, 1);
    assertSegments("rows", rows, 1);
    return compact(columns, rows, regularTriangles(columns, rows));
}

/**
 * Creates a single grid whose edges connect without cracks to neighbours one level coarser or finer.
 *
 * A finer neighbour adds the midpoint of every edge segment; a coarser neighbour removes every other edge vertex.
 * Only one tile of a junction adapts: the coarse tile with `Finer`, or the fine tile with `Coarser`.
 */
export function createJunctionGridTopology(columns: number, rows: number = columns, lods: GridEdgeLods = SAME_EDGE_LODS): IGridTopology {
    assertSegments("columns", columns, 2);
    assertSegments("rows", rows, 2);
    for (const edge of TILE_EDGE_NEIGHBORS) assertEdgeLod(edge, lods[edge], columns, rows);
    return compact(columns, rows, junctionTriangles(columns, rows, lods));
}

/** Memoizes the 81 single-grid variants of one grid size. */
export class JunctionGridTopologyCache {
    private readonly variants = new Map<number, IGridTopology>();

    public constructor(
        public readonly columns: number,
        public readonly rows: number = columns
    ) {
        assertSegments("columns", columns, 2);
        assertSegments("rows", rows, 2);
    }

    public get(lods: GridEdgeLods = SAME_EDGE_LODS): IGridTopology {
        const key = edgeLodsKey(lods);
        let topology = this.variants.get(key);
        if (!topology) {
            topology = createJunctionGridTopology(this.columns, this.rows, lods);
            this.variants.set(key, topology);
        }
        return topology;
    }
}

/**
 * Assigns a triangle to the corner piece whose corner it touches, else to the edge band of an edge it touches, else
 * to the interior at `TileNeighbor.C`. Only triangles touching an edge change with the level of that edge.
 */
function pieceOf(triangle: Triangle, columns: number, rows: number): TileNeighbor {
    const right = 2 * columns;
    const bottom = 2 * rows;
    const has = (u: number, v: number) => triangle.some((point) => point[0] === u && point[1] === v);
    if (has(0, 0)) return TileNeighbor.NW;
    if (has(right, 0)) return TileNeighbor.NE;
    if (has(right, bottom)) return TileNeighbor.SE;
    if (has(0, bottom)) return TileNeighbor.SW;
    if (triangle.some((point) => point[1] === 0)) return TileNeighbor.N;
    if (triangle.some((point) => point[0] === right)) return TileNeighbor.E;
    if (triangle.some((point) => point[1] === bottom)) return TileNeighbor.S;
    if (triangle.some((point) => point[0] === 0)) return TileNeighbor.W;
    return TileNeighbor.C;
}

/**
 * The junction grid split into an interior, four edge bands and four corner pieces, placed like the
 * {@link TileNeighbor} layout.
 *
 * The interior never changes. Each edge band has one variant per neighbour level and each corner piece one variant
 * per level pair of its two edges, so changing a neighbour swaps a few small pieces instead of the whole grid.
 * Drawing the pieces costs more draw calls, but they can be instanced across tiles.
 */
export class GridJunctionPieces {
    public readonly interior: IGridTopology;
    private readonly edgePieces = new Map<string, IGridTopology>();
    private readonly cornerPieces = new Map<string, IGridTopology>();

    /** `columns` and `rows` must be even and at least 4, so that no triangle touches two edges away from a corner. */
    public constructor(
        public readonly columns: number,
        public readonly rows: number = columns
    ) {
        assertSegments("columns", columns, 4);
        assertSegments("rows", rows, 4);
        if (columns % 2 !== 0 || rows % 2 !== 0) throw new RangeError("Grid junction pieces require even columns and rows.");

        const piece = (lods: GridEdgeLods, name: TileNeighbor): IGridTopology =>
            compact(
                columns,
                rows,
                junctionTriangles(columns, rows, lods).filter((triangle) => pieceOf(triangle, columns, rows) === name)
            );

        this.interior = piece(SAME_EDGE_LODS, TileNeighbor.C);
        for (const edge of TILE_EDGE_NEIGHBORS) {
            for (const lod of NEIGHBOR_LODS) this.edgePieces.set(`${edge}:${lod}`, piece({ ...SAME_EDGE_LODS, [edge]: lod }, edge));
        }
        for (const corner of TILE_CORNER_NEIGHBORS) {
            const [first, second] = TILE_CORNER_EDGES[corner];
            for (const firstLod of NEIGHBOR_LODS) {
                for (const secondLod of NEIGHBOR_LODS) {
                    const lods = { ...SAME_EDGE_LODS, [first]: firstLod, [second]: secondLod };
                    this.cornerPieces.set(`${corner}:${firstLod}:${secondLod}`, piece(lods, corner));
                }
            }
        }
    }

    public edge(edge: TileEdgeNeighbor, lod: NeighborLod): IGridTopology {
        return this.edgePieces.get(`${edge}:${lod}`)!;
    }

    /** Corner piece for the levels of the two edges meeting at the corner. */
    public corner(corner: TileCornerNeighbor, lods: GridEdgeLods): IGridTopology {
        const [first, second] = TILE_CORNER_EDGES[corner];
        return this.cornerPieces.get(`${corner}:${lods[first]}:${lods[second]}`)!;
    }

    /** The nine pieces covering a tile whose neighbours have the given levels, indexed by {@link TileNeighbor}. */
    public select(lods: GridEdgeLods = SAME_EDGE_LODS): GridJunctionSelection {
        return Array.from({ length: 9 }, (_, neighbor: TileNeighbor) => {
            if (neighbor === TileNeighbor.C) return this.interior;
            if (neighbor in TILE_CORNER_EDGES) return this.corner(neighbor as TileCornerNeighbor, lods);
            return this.edge(neighbor as TileEdgeNeighbor, lods[neighbor as TileEdgeNeighbor]);
        });
    }
}
