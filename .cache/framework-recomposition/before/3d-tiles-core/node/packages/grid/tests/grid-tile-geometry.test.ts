import {
    CUBE_FACE_COUNT,
    CUBE_FACE_EDGES,
    CubeFace,
    CubeTileSurface,
    ReferenceSurface,
    TILE_EDGE_NEIGHBORS,
    TileNeighbor,
    WebMercatorTileSurface,
    cubeTileNeighbor,
    planetocentricDirection,
    type ICartesian3,
    type ITileAddress,
    type ITileSurface,
    type TileEdgeNeighbor,
} from "@spacexr/tiles";
import { describe, expect, it } from "vitest";

import { NeighborLod, buildGridTileGeometry, buildGridTileShape, createGridTopology, createJunctionGridTopology } from "../src";

const MOON = new CubeTileSurface(ReferenceSurface.sphere(1737400));
const MARS = new CubeTileSurface(new ReferenceSurface(3396190, 3396190, 3376200));
const EARTH = new WebMercatorTileSurface();

const vertexAt = (data: Float32Array, vertex: number): ICartesian3 => ({ x: data[vertex * 3]!, y: data[vertex * 3 + 1]!, z: data[vertex * 3 + 2]! });
const distance = (a: ICartesian3, b: ICartesian3): number => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
const added = (center: ICartesian3, offset: ICartesian3): ICartesian3 => ({ x: center.x + offset.x, y: center.y + offset.y, z: center.z + offset.z });

/** Tile coordinates of a point of an edge at parameter `t`, `t` running with `s` or `t`. */
function edgePoint(edge: TileEdgeNeighbor, t: number): [number, number] {
    if (edge === TileNeighbor.N) return [t, 0];
    if (edge === TileNeighbor.S) return [t, 1];
    if (edge === TileNeighbor.W) return [0, t];
    return [1, t];
}

describe("buildGridTileGeometry", () => {
    it("places vertices relative to the tile centre, on the cube and on Web Mercator", () => {
        const topology = createGridTopology(4);
        for (const [surface, address] of [
            [MOON, { face: CubeFace.South, lod: 11, x: 1024, y: 1023 }],
            [MARS, { face: CubeFace.North, lod: 6, x: 3, y: 60 }],
            [EARTH, { lod: 12, x: 2100, y: 1400 }],
        ] as Array<[ITileSurface, ITileAddress]>) {
            const geometry = buildGridTileGeometry(topology, address, surface);
            expect(distance(geometry.center, surface.point(address, 0.5, 0.5))).toBe(0);
            const lastVertex = geometry.positions.length / 3 - 1;
            expect(distance(added(geometry.center, vertexAt(geometry.positions, 0)), surface.point(address, 0, 0))).toBeLessThan(1e-2);
            expect(distance(added(geometry.center, vertexAt(geometry.positions, lastVertex)), surface.point(address, 1, 1))).toBeLessThan(1e-2);
            expect(Math.hypot(...Object.values(vertexAt(geometry.ups, 0)))).toBeCloseTo(1, 6);
            expect(geometry.indices).toBe(topology.indices);
        }
    });

    it("moves vertices along the up vector of the surface by their height", () => {
        const topology = createGridTopology(2);
        const address = { face: CubeFace.PositiveY, lod: 8, x: 100, y: 200 };
        const flat = buildGridTileGeometry(topology, address, MARS);
        const raised = buildGridTileGeometry(topology, address, MARS, { heightInitializer: ({ column, row }) => 100 * (column + 3 * row) });
        for (let vertex = 0; vertex < flat.positions.length / 3; vertex++) {
            const a = vertexAt(flat.positions, vertex);
            const b = vertexAt(raised.positions, vertex);
            const up = vertexAt(flat.ups, vertex);
            const height = (b.x - a.x) * up.x + (b.y - a.y) * up.y + (b.z - a.z) * up.z;
            expect(height).toBeCloseTo(distance(a, b), 1);
        }
        // Vertex 8 is the south-east corner: column 2, row 2.
        expect(distance(vertexAt(flat.positions, 8), vertexAt(raised.positions, 8))).toBeCloseTo(800, 1);
    });

    it("keeps heights on the rays of the cube, along the normal on Web Mercator", () => {
        const topology = createGridTopology(2);
        const cube = buildGridTileGeometry(topology, { face: CubeFace.North, lod: 4, x: 3, y: 9 }, MARS, { heightInitializer: () => 21000 });
        const up = vertexAt(cube.ups, 0);
        const point = added(cube.center, vertexAt(cube.positions, 0));
        const length = Math.hypot(point.x, point.y, point.z);
        expect(distance({ x: point.x / length, y: point.y / length, z: point.z / length }, up)).toBeLessThan(1e-6);

        // At 45 degrees on WGS84, the normal is at the geodetic latitude, off the ray from the centre.
        const up45 = EARTH.up({ lod: 1, x: 1, y: 0 }, 0.5, 0.5);
        const point45 = EARTH.point({ lod: 1, x: 1, y: 0 }, 0.5, 0.5);
        const radial = Math.hypot(point45.x, point45.y, point45.z);
        expect(distance({ x: point45.x / radial, y: point45.y / radial, z: point45.z / radial }, up45)).toBeGreaterThan(1e-3);
    });

    it("winds triangles counter-clockwise seen from outside on every face", () => {
        const topology = createJunctionGridTopology(4, 4, {
            [TileNeighbor.N]: NeighborLod.Finer,
            [TileNeighbor.E]: NeighborLod.Coarser,
            [TileNeighbor.S]: NeighborLod.Same,
            [TileNeighbor.W]: NeighborLod.Finer,
        });
        const addresses: Array<[ITileSurface, ITileAddress]> = Array.from({ length: CUBE_FACE_COUNT }, (_, face) => [MOON, { face, lod: 3, x: 2, y: 5 }]);
        addresses.push([EARTH, { lod: 3, x: 2, y: 5 }]);
        for (const [surface, address] of addresses) {
            const { positions, ups, indices } = buildGridTileGeometry(topology, address, surface);
            for (let offset = 0; offset < indices.length; offset += 3) {
                const a = vertexAt(positions, indices[offset]!);
                const b = vertexAt(positions, indices[offset + 1]!);
                const c = vertexAt(positions, indices[offset + 2]!);
                const up = vertexAt(ups, indices[offset]!);
                const ab = { x: b.x - a.x, y: b.y - a.y, z: b.z - a.z };
                const ac = { x: c.x - a.x, y: c.y - a.y, z: c.z - a.z };
                const normal = { x: ab.y * ac.z - ab.z * ac.y, y: ab.z * ac.x - ab.x * ac.z, z: ab.x * ac.y - ab.y * ac.x };
                expect(normal.x * up.x + normal.y * up.y + normal.z * up.z).toBeGreaterThan(0);
            }
        }
    });

    it("gives the same points on both sides of every face edge, midpoints included", () => {
        const cells = 10;
        const refined = createJunctionGridTopology(cells, cells, {
            [TileNeighbor.N]: NeighborLod.Finer,
            [TileNeighbor.E]: NeighborLod.Finer,
            [TileNeighbor.S]: NeighborLod.Finer,
            [TileNeighbor.W]: NeighborLod.Finer,
        });
        const lod = 5;
        const last = 2 ** lod - 1;
        const height = 1234.5;
        for (let face = 0; face < CUBE_FACE_COUNT; face++) {
            for (const edge of TILE_EDGE_NEIGHBORS) {
                // A tile on the edge of its face, off its corners.
                const address: ITileAddress = {
                    face,
                    lod,
                    x: edge === TileNeighbor.W ? 0 : edge === TileNeighbor.E ? last : 7,
                    y: edge === TileNeighbor.N ? 0 : edge === TileNeighbor.S ? last : 7,
                };
                const neighbor = cubeTileNeighbor(address, edge)!;
                const junction = CUBE_FACE_EDGES[face]![edge];
                const geometry = buildGridTileGeometry(refined, address, MARS, { heightInitializer: () => height });
                const other = buildGridTileGeometry(refined, neighbor.address, MARS, { heightInitializer: () => height });
                let compared = 0;
                for (let vertex = 0; vertex < refined.coordinates.length / 2; vertex++) {
                    const u = refined.coordinates[vertex * 2]!;
                    const v = refined.coordinates[vertex * 2 + 1]!;
                    const along = edge === TileNeighbor.N || edge === TileNeighbor.S ? u : v;
                    const onEdge = edge === TileNeighbor.N ? v === 0 : edge === TileNeighbor.S ? v === 1 : edge === TileNeighbor.W ? u === 0 : u === 1;
                    if (!onEdge) continue;
                    const [u2, v2] = edgePoint(junction.edge, junction.reversed ? 1 - along : along);
                    const match = Array.from({ length: refined.coordinates.length / 2 }, (_, index) => index).find(
                        (index) => Math.abs(refined.coordinates[index * 2]! - u2) < 1e-5 && Math.abs(refined.coordinates[index * 2 + 1]! - v2) < 1e-5
                    );
                    expect(match).toBeDefined();
                    const own = added(geometry.center, vertexAt(geometry.positions, vertex));
                    const theirs = added(other.center, vertexAt(other.positions, match!));
                    // Offsets are 32-bit floats within a tile of about 170 km; the doubles behind them are identical.
                    expect(distance(own, theirs)).toBeLessThan(0.05);
                    compared++;
                }
                expect(compared).toBe(2 * cells + 1);
            }
        }
    });

    it("computes shared edge points exactly, whatever the number of cells", () => {
        // 1 / 10 is not exact in 32 bits: the lattice is recovered in double precision.
        const topology = createGridTopology(10);
        const values: number[] = [];
        buildGridTileGeometry(topology, { face: 0, lod: 2, x: 1, y: 1 }, MOON, {
            heightInitializer: ({ u }) => {
                values.push(u);
                return 0;
            },
        });
        expect(values[3]).toBe(3 / 10);
    });

    it("rejects tiles that do not belong to the surface", () => {
        const topology = createGridTopology(2);
        expect(() => buildGridTileGeometry(topology, { face: 2, lod: 1, x: 0, y: 0 }, EARTH)).toThrow(RangeError);
        expect(() => buildGridTileGeometry(topology, { face: 6, lod: 1, x: 0, y: 0 }, MOON)).toThrow(RangeError);
        expect(() => buildGridTileGeometry(topology, { face: 1, lod: 1, x: 2, y: 0 }, MOON)).toThrow(RangeError);
    });
});

describe("buildGridTileShape", () => {
    /** Body-fixed point of a vertex of a shape: `center + Rz(rotation) * position`. */
    function shapePoint(center: ICartesian3, rotation: number, position: ICartesian3): ICartesian3 {
        return {
            x: center.x + Math.cos(rotation) * position.x - Math.sin(rotation) * position.y,
            y: center.y + Math.sin(rotation) * position.x + Math.cos(rotation) * position.y,
            z: center.z + position.z,
        };
    }

    it("shares one shape along a Web Mercator row, turned by the longitude of each tile", () => {
        const cells = 8;
        const first = { lod: 10, x: 100, y: 300 };
        const second = { lod: 10, x: 777, y: 300 };
        const shape = buildGridTileShape(first, EARTH, cells);
        const other = buildGridTileShape(second, EARTH, cells);

        expect(other.key).toBe(shape.key);
        expect(buildGridTileShape({ lod: 10, x: 100, y: 301 }, EARTH, cells).key).not.toBe(shape.key);
        expect(other.rotation).toBeCloseTo(((777.5 / 1024) * 2 - 1) * Math.PI, 12);
        for (let vertex = 0; vertex < shape.positions.length / 3; vertex += 7) {
            expect(distance(vertexAt(shape.positions, vertex), vertexAt(other.positions, vertex))).toBeLessThan(1e-2);
        }
        // The shape of the first tile places the second one.
        const side = cells + 1;
        const vertex = 2 * side + 5;
        const point = shapePoint(other.center, other.rotation, vertexAt(shape.positions, vertex));
        expect(distance(point, EARTH.point(second, 5 / cells, 2 / cells))).toBeLessThan(1e-2);
    });

    it("matches the shape of the GPU terrain engine on Web Mercator", () => {
        const cells = 4;
        const address = { lod: 3, x: 4, y: 2 };
        const shape = buildGridTileShape(address, EARTH, cells);
        // Centred on longitude 0, along +X: north-west corner of the tile, computed from the Web Mercator formula.
        const a = 6378137;
        const e2 = 0.00669437999014;
        const latitude = (ordinate: number): number => Math.atan(Math.sinh(Math.PI * (1 - 2 * ordinate)));
        const ecef = (lat: number, lon: number): ICartesian3 => {
            const n = a / Math.sqrt(1 - e2 * Math.sin(lat) ** 2);
            return { x: n * Math.cos(lat) * Math.cos(lon), y: n * Math.cos(lat) * Math.sin(lon), z: n * (1 - e2) * Math.sin(lat) };
        };
        const center = ecef(latitude(2.5 / 8), 0);
        const corner = ecef(latitude(2 / 8), (-0.5 * 2 * Math.PI) / 8);
        const expected = { x: corner.x - center.x, y: corner.y - center.y, z: corner.z - center.z };
        expect(distance(vertexAt(shape.positions, 0), expected)).toBeLessThan(2);
        expect(vertexAt(shape.ups, 0).z).toBeCloseTo(Math.sin(latitude(2 / 8)), 6);
    });

    it("gives each cube tile its own shape, unturned", () => {
        const cells = 4;
        const address = { face: CubeFace.South, lod: 11, x: 1000, y: 1100 };
        const shape = buildGridTileShape(address, MOON, cells);
        expect(shape.key).toBe("5/11/1000/1100");
        expect(shape.rotation).toBe(0);
        expect(buildGridTileShape({ lod: 2, x: 1, y: 1 }, MOON, cells).key).toBe("0/2/1/1");
        const point = shapePoint(shape.center, shape.rotation, vertexAt(shape.positions, cells));
        expect(distance(point, MOON.point(address, 1, 0))).toBeLessThan(1e-3);
        // The tiles of the south pole lie around it, with small offsets.
        const pole = planetocentricDirection(-90, 0);
        const size = Math.hypot(...Object.values(vertexAt(buildGridTileShape({ face: CubeFace.South, lod: 11, x: 1024, y: 1024 }, MOON, cells).positions, 0)));
        expect(size).toBeLessThan(2000);
        expect(pole.z).toBe(-1);
    });

    it("rejects invalid cell counts", () => {
        expect(() => buildGridTileShape({ lod: 0, x: 0, y: 0 }, EARTH, 0)).toThrow(RangeError);
        expect(() => buildGridTileShape({ lod: 0, x: 0, y: 0 }, EARTH, 1.5)).toThrow(RangeError);
    });
});
