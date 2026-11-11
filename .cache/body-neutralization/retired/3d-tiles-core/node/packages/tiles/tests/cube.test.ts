import { Ellipsoid, type ICartesian3 } from "@spacexr/geodesy";
import { describe, expect, it } from "vitest";

import {
    CUBE_FACE_COUNT,
    CUBE_FACE_EDGES,
    CUBE_FACE_FRAMES,
    CubeFace,
    ReferenceSurface,
    TILE_CORNER_NEIGHBORS,
    TILE_EDGE_NEIGHBORS,
    TileNeighbor,
    childTileAddresses,
    cubeCornerTileCount,
    cubeFaceCoordinates,
    cubeFaceDirection,
    cubeFaceOfDirection,
    cubeTileDirection,
    cubeTileGeometricError,
    cubeTileNeighbor,
    cubeTileNeighbors,
    cubeTileOfDirection,
    directionToPlanetocentric,
    expandTileUrlTemplate,
    isValidTileAddress,
    oppositeTileEdge,
    parentTileAddress,
    planetocentricDirection,
    turnTileEdge,
    type ITileAddress,
    type TileEdgeNeighbor,
} from "../src";

const cross = (a: ICartesian3, b: ICartesian3): ICartesian3 => ({ x: a.y * b.z - a.z * b.y, y: a.z * b.x - a.x * b.z, z: a.x * b.y - a.y * b.x });
const distance = (a: ICartesian3, b: ICartesian3): number => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
const faces = Array.from({ length: CUBE_FACE_COUNT }, (_, face) => face as CubeFace);

/** Face coordinates of a point of an edge at parameter `t`, `t` running with `u` or `v`. */
function edgePoint(edge: TileEdgeNeighbor, t: number): [number, number] {
    if (edge === TileNeighbor.N) return [t, 0];
    if (edge === TileNeighbor.S) return [t, 1];
    if (edge === TileNeighbor.W) return [0, t];
    return [1, t];
}

/** Tile containing a point just beyond a side or corner of a tile, through the inverse mapping. */
function tileBeyond(address: ITileAddress, neighbor: TileNeighbor): ITileAddress {
    const epsilon = 1e-7;
    const [dx, dy] = [(neighbor % 3) - 1, Math.floor(neighbor / 3) - 1];
    const s = dx < 0 ? -epsilon : dx > 0 ? 1 + epsilon : 0.5;
    const t = dy < 0 ? -epsilon : dy > 0 ? 1 + epsilon : 0.5;
    return cubeTileOfDirection(cubeTileDirection(address, s, t), address.lod);
}

describe("cube faces", () => {
    it("orient every face like an image seen from outside, u x v = -centre", () => {
        for (const { center, u, v } of CUBE_FACE_FRAMES) {
            const normal = cross(u, v);
            expect([normal.x + center.x, normal.y + center.y, normal.z + center.z]).toEqual([0, 0, 0]);
        }
    });

    it("maps face centres to the axes and the poles to the polar faces", () => {
        expect(cubeFaceDirection(CubeFace.PositiveY, 0.5, 0.5)).toEqual({ x: 0, y: 1, z: 0 });
        expect(cubeFaceCoordinates({ x: 0, y: 0, z: 1 })).toEqual({ face: CubeFace.North, u: 0.5, v: 0.5 });
        expect(cubeFaceOfDirection({ x: 0, y: 0, z: -2 })).toBe(CubeFace.South);
        // u grows eastward and v southward on the equatorial faces.
        const east = cubeFaceDirection(CubeFace.PositiveX, 0.6, 0.5);
        const south = cubeFaceDirection(CubeFace.PositiveX, 0.5, 0.6);
        expect(directionToPlanetocentric(east).longitude).toBeGreaterThan(0);
        expect(directionToPlanetocentric(south).latitude).toBeLessThan(0);
    });

    it("round-trips face coordinates with the equi-angular mapping", () => {
        let worst = 0;
        for (const face of faces) {
            for (let i = 0; i <= 20; i++) {
                for (let j = 0; j <= 20; j++) {
                    const u = 0.001 + 0.998 * (i / 20);
                    const v = 0.001 + 0.998 * (j / 20);
                    const back = cubeFaceCoordinates(cubeFaceDirection(face, u, v));
                    expect(back.face).toBe(face);
                    worst = Math.max(worst, Math.abs(back.u - u), Math.abs(back.v - v));
                }
            }
        }
        expect(worst).toBeLessThan(1e-14);
    });

    it("gives cube edges to the first axis in the order X, Y, Z", () => {
        expect(cubeFaceOfDirection({ x: 1, y: 0, z: 1 })).toBe(CubeFace.PositiveX);
        expect(cubeFaceOfDirection({ x: 0, y: -1, z: 1 })).toBe(CubeFace.NegativeY);
        expect(cubeFaceOfDirection({ x: -1, y: 1, z: 0 })).toBe(CubeFace.NegativeX);
        expect(cubeFaceOfDirection({ x: 1, y: 1, z: 1 })).toBe(CubeFace.PositiveX);
    });

    it("rejects zero and non-finite directions", () => {
        expect(() => cubeFaceOfDirection({ x: 0, y: 0, z: 0 })).toThrow(RangeError);
        expect(() => cubeFaceCoordinates({ x: Number.NaN, y: 1, z: 0 })).toThrow(RangeError);
        expect(() => cubeFaceOfDirection({ x: Number.POSITIVE_INFINITY, y: 0, z: 0 })).toThrow(RangeError);
        expect(() => directionToPlanetocentric({ x: 0, y: 0, z: 0 })).toThrow(RangeError);
        expect(() => cubeFaceDirection(6 as CubeFace, 0.5, 0.5)).toThrow(RangeError);
    });

    it("keeps the cell areas of a face within a ratio of 1.41", () => {
        const cells = 64;
        let smallest = Number.POSITIVE_INFINITY;
        let largest = 0;
        for (let i = 0; i < cells; i++) {
            for (let j = 0; j < cells; j++) {
                const a = cubeFaceDirection(CubeFace.PositiveX, i / cells, j / cells);
                const b = cubeFaceDirection(CubeFace.PositiveX, (i + 1) / cells, j / cells);
                const c = cubeFaceDirection(CubeFace.PositiveX, i / cells, (j + 1) / cells);
                const area = Math.hypot(...Object.values(cross({ x: b.x - a.x, y: b.y - a.y, z: b.z - a.z }, { x: c.x - a.x, y: c.y - a.y, z: c.z - a.z })));
                smallest = Math.min(smallest, area);
                largest = Math.max(largest, area);
            }
        }
        expect(largest / smallest).toBeLessThan(1.45);
    });
});

describe("cube tile addresses", () => {
    it("carry their face through parents, children and URL templates", () => {
        const address = { face: CubeFace.South, lod: 3, x: 5, y: 2 };

        expect(parentTileAddress(address)).toEqual({ face: CubeFace.South, lod: 2, x: 2, y: 1 });
        expect(childTileAddresses(address)[3]).toEqual({ face: CubeFace.South, lod: 4, x: 11, y: 5 });
        expect(expandTileUrlTemplate("https://tiles.example.com/{face}/{z}/{x}/{y}.png", address)).toBe("https://tiles.example.com/5/3/5/2.png");
        expect(expandTileUrlTemplate("{face}/{z}", { lod: 1, x: 0, y: 1 })).toBe("0/1");
        expect(parentTileAddress({ lod: 1, x: 1, y: 0 })).not.toHaveProperty("face");
    });

    it("reject faces outside the cube", () => {
        expect(isValidTileAddress({ face: 5, lod: 0, x: 0, y: 0 })).toBe(true);
        expect(isValidTileAddress({ face: 6, lod: 0, x: 0, y: 0 })).toBe(false);
        expect(isValidTileAddress({ face: -1, lod: 0, x: 0, y: 0 })).toBe(false);
        expect(isValidTileAddress({ face: 1.5, lod: 0, x: 0, y: 0 })).toBe(false);
        expect(() => cubeTileDirection({ face: 7, lod: 2, x: 0, y: 0 }, 0.5, 0.5)).toThrow("7/2/0/0");
    });

    it("find the tile of a direction, the poles at the junction of four tiles", () => {
        expect(cubeTileOfDirection({ x: 0, y: 0, z: 1 }, 1)).toEqual({ face: CubeFace.North, lod: 1, x: 1, y: 1 });
        expect(cubeTileOfDirection(planetocentricDirection(-89.9, 0), 11).face).toBe(CubeFace.South);
        const address = { face: CubeFace.NegativeY, lod: 6, x: 17, y: 40 };
        expect(cubeTileOfDirection(cubeTileDirection(address, 0.3, 0.8), 6)).toEqual(address);
    });

    it("convert planetocentric coordinates", () => {
        const direction = planetocentricDirection(30, -120);
        const back = directionToPlanetocentric(direction);
        expect(back.latitude).toBeCloseTo(30, 12);
        expect(back.longitude).toBeCloseTo(-120, 12);
        expect(directionToPlanetocentric({ x: -1, y: -0, z: 0 }).longitude).toBe(180);
    });
});

describe("cube neighbours", () => {
    it("match the edge table to the geometry of the faces", () => {
        for (const face of faces) {
            for (const edge of TILE_EDGE_NEIGHBORS) {
                const junction = CUBE_FACE_EDGES[face]![edge];
                for (const t of [0, 0.2, 0.5, 0.9, 1]) {
                    const [u, v] = edgePoint(edge, t);
                    const [u2, v2] = edgePoint(junction.edge, junction.reversed ? 1 - t : t);
                    expect(distance(cubeFaceDirection(face, u, v), cubeFaceDirection(junction.face, u2, v2))).toBeLessThan(1e-15);
                }
                // Turning the edge into the neighbour's frame points away from the neighbour's own edge.
                expect(turnTileEdge(edge, junction.turns)).toBe(oppositeTileEdge(junction.edge));
                // The junction is symmetric.
                const back = CUBE_FACE_EDGES[junction.face]![junction.edge];
                expect(back).toMatchObject({ face, edge, reversed: junction.reversed, turns: (4 - junction.turns) % 4 });
            }
        }
    });

    it("join equatorial faces without turns and polar faces with 1 to 3 quarter turns", () => {
        for (const face of [0, 1, 2, 3] as CubeFace[]) {
            expect(CUBE_FACE_EDGES[face]![TileNeighbor.E].turns).toBe(0);
            expect(CUBE_FACE_EDGES[face]![TileNeighbor.W].turns).toBe(0);
        }
        expect(CUBE_FACE_EDGES[CubeFace.PositiveX]![TileNeighbor.N]).toEqual({ face: CubeFace.North, edge: TileNeighbor.S, reversed: false, turns: 0 });
        expect(CUBE_FACE_EDGES[CubeFace.PositiveY]![TileNeighbor.N]).toEqual({ face: CubeFace.North, edge: TileNeighbor.E, reversed: true, turns: 3 });
    });

    it("give the tile containing the points beyond every edge and corner", () => {
        for (const lod of [0, 1, 3]) {
            const count = 2 ** lod;
            for (const face of faces) {
                for (let x = 0; x < count; x++) {
                    for (let y = 0; y < count; y++) {
                        const address = { face, lod, x, y };
                        const neighbors = cubeTileNeighbors(address);
                        expect(neighbors[TileNeighbor.C]).toEqual({ address, turns: 0 });
                        for (const edge of TILE_EDGE_NEIGHBORS) expect(neighbors[edge]!.address).toEqual(tileBeyond(address, edge));
                        for (const corner of TILE_CORNER_NEIGHBORS) {
                            const neighbor = neighbors[corner];
                            if (cubeCornerTileCount(address, corner) === 3) {
                                expect(neighbor).toBeUndefined();
                                // Only 3 tiles meet: the point beyond the corner lies in one of the two edge neighbours.
                                const beyond = tileBeyond(address, corner);
                                const edges = [neighbors[corner - (corner % 3) + 1], neighbors[corner + 3 * (corner < 3 ? 1 : -1)]];
                                expect(edges.some((edgeNeighbor) => JSON.stringify(edgeNeighbor?.address) === JSON.stringify(beyond))).toBe(true);
                            } else {
                                expect(neighbor!.address).toEqual(tileBeyond(address, corner));
                            }
                        }
                    }
                }
            }
        }
    });

    it("count three tiles only at the eight vertices of the cube", () => {
        let vertices = 0;
        for (const face of faces) {
            for (let x = 0; x < 4; x++) {
                for (let y = 0; y < 4; y++) {
                    for (const corner of TILE_CORNER_NEIGHBORS) if (cubeCornerTileCount({ face, lod: 2, x, y }, corner) === 3) vertices++;
                }
            }
        }
        // 8 vertices, each a corner of 3 tiles.
        expect(vertices).toBe(24);
    });

    it("put the samples of a shared edge on the same directions on both faces", () => {
        const lod = 11;
        const samples = 256;
        const address = { face: CubeFace.PositiveY, lod, x: 1500, y: 0 };
        const neighbor = cubeTileNeighbor(address, TileNeighbor.N)!;
        const junction = CUBE_FACE_EDGES[CubeFace.PositiveY]![TileNeighbor.N];
        expect(junction.edge).toBe(TileNeighbor.E);
        for (let i = 0; i <= samples; i += 16) {
            const t = i / samples;
            const own = cubeTileDirection(address, t, 0);
            const theirs = cubeTileDirection(neighbor.address, 1, junction.reversed ? 1 - t : t);
            expect(distance(own, theirs)).toBeLessThan(1e-15);
        }
    });

    it("rejects invalid addresses", () => {
        expect(() => cubeTileNeighbor({ face: 2, lod: 1, x: 2, y: 0 }, TileNeighbor.N)).toThrow(RangeError);
        expect(() => turnTileEdge(TileNeighbor.NE as unknown as TileEdgeNeighbor, 1)).toThrow(RangeError);
    });
});

describe("reference surfaces", () => {
    it("measure radii along rays on spheres, ellipsoids and triaxial bodies", () => {
        const moon = ReferenceSurface.sphere(1737400);
        expect(moon.radius(planetocentricDirection(-89.7, 120))).toBeCloseTo(1737400, 6);

        const earth = ReferenceSurface.fromEllipsoid(Ellipsoid.WGS84);
        expect(earth.radius({ x: 0, y: 1, z: 0 })).toBeCloseTo(Ellipsoid.WGS84.semiMajorAxis, 6);
        expect(earth.radius({ x: 0, y: 0, z: -1 })).toBeCloseTo(Ellipsoid.WGS84.semiMinorAxis, 6);

        const body = new ReferenceSurface(13000, 11400, 9100);
        expect(body.radius({ x: 1, y: 0, z: 0 })).toBeCloseTo(13000, 9);
        expect(body.radius({ x: 0, y: 1, z: 0 })).toBeCloseTo(11400, 9);
        expect(body.radius({ x: 0, y: 0, z: 1 })).toBeCloseTo(9100, 9);
    });

    it("place points on their ray and read their radial height back", () => {
        const surface = new ReferenceSurface(3396190, 3396190, 3376200);
        const direction = cubeTileDirection({ face: CubeFace.North, lod: 4, x: 3, y: 9 }, 0.25, 0.75);
        const point = surface.point(direction, 21229);
        expect(surface.height(point)).toBeCloseTo(21229, 6);
        const length = Math.hypot(point.x, point.y, point.z);
        expect(distance({ x: point.x / length, y: point.y / length, z: point.z / length }, direction)).toBeLessThan(1e-15);
        expect(() => surface.height({ x: 0, y: 0, z: 0 })).toThrow(RangeError);
    });

    it("give the normal of the ellipsoid, which leaves the ray off the axes", () => {
        const sphere = ReferenceSurface.sphere(1000);
        const direction = planetocentricDirection(40, 10);
        expect(distance(sphere.normal(sphere.point(direction)), direction)).toBeLessThan(1e-15);

        const saturn = new ReferenceSurface(60268000, 60268000, 54364000);
        const p = saturn.point(planetocentricDirection(45, 0));
        const n = saturn.normal(p);
        const latitudeOfNormal = Math.asin(n.z) * (180 / Math.PI);
        // The geodetic latitude exceeds the planetocentric one by about 5.9 degrees around 45 degrees on Saturn.
        expect(latitudeOfNormal - 45).toBeGreaterThan(5.5);
        expect(distance(saturn.normal({ x: 0, y: 0, z: 54364000 }), { x: 0, y: 0, z: 1 })).toBe(0);
    });

    it("rejects radii that are not positive finite metres", () => {
        expect(() => new ReferenceSurface(0, 1, 1)).toThrow(RangeError);
        expect(() => new ReferenceSurface(1, -1, 1)).toThrow(RangeError);
        expect(() => ReferenceSurface.sphere(Number.NaN)).toThrow(RangeError);
    });

    it("measures the geometric error of a tile from its longest edge", () => {
        const moon = ReferenceSurface.sphere(1737400);
        // Near the centre of a face, level 11 samples are about pi / 2 * R / (256 * 2^11) apart.
        const centre = cubeTileGeometricError({ face: CubeFace.South, lod: 11, x: 1024, y: 1024 }, moon, 256);
        expect(centre).toBeCloseTo((Math.PI / 2) * (1737400 / (256 * 2048)), 2);
        // Tiles at the corners of a face are smaller on the sphere than at its centre, but not by more than the mapping allows.
        const corner = cubeTileGeometricError({ face: CubeFace.South, lod: 11, x: 0, y: 0 }, moon, 256);
        expect(corner / centre).toBeGreaterThan(0.6);
        expect(corner / centre).toBeLessThan(1.1);
        expect(() => cubeTileGeometricError({ face: 0, lod: 0, x: 0, y: 0 }, moon, 0)).toThrow(RangeError);
    });
});
