import {
    CUBE_FACE_COUNT,
    CUBE_TILE_TOPOLOGY,
    CubeFace,
    TILE_CORNER_NEIGHBORS,
    TILE_EDGE_NEIGHBORS,
    TileNeighbor,
    childTileAddresses,
    cubeCornerTileCount,
    cubeTileDirection,
    parentTileAddress,
    tileAddressKey,
    turnedTileCoordinates,
    type ITileAddress,
} from "@spacexr/tiles";
import { describe, expect, it } from "vitest";

import { DrapeInstanceCut, DrapeInstanceEdge, type IDrapeInstance } from "../src";

describe("instance cut over data of varying depth", () => {
    const fine = { face: 0, lod: 2, x: 0, y: 0 };
    const coarse = { face: 0, lod: 2, x: 1, y: 0 };
    const edgeTerrains = (options: ConstructorParameters<typeof DrapeInstanceCut>[0]): ITileAddress => {
        const cut = new DrapeInstanceCut({ topology: CUBE_TILE_TOPOLOGY, ...options });
        const instance = cut.update([fine, coarse], [], 0).find(({ address }) => address.x === fine.x)!;
        // Its east edge.
        return instance.edgeTerrain[1];
    };

    it("reads the coarsest data on an edge between tiles of one level", () => {
        expect(edgeTerrains({ terrainDataLevel: (terrain) => (terrain.x === 1 ? 0 : 2) })).toEqual(coarse);
    });

    it("keeps its own terrain without that option, and when the data has one level", () => {
        expect(edgeTerrains({})).toEqual(fine);
        expect(edgeTerrains({ terrainDataLevel: () => 2 })).toEqual(fine);
    });
});

/** The six faces at a level, every tile a terrain tile. */
function allTiles(lod: number): ITileAddress[] {
    const tiles: ITileAddress[] = [];
    const count = 2 ** lod;
    for (let face = 0; face < CUBE_FACE_COUNT; face++) {
        for (let x = 0; x < count; x++) for (let y = 0; y < count; y++) tiles.push({ face, lod, x, y });
    }
    return tiles;
}

/** Leaf of a cut containing a tile, or `undefined` when the tile is subdivided. */
function leafContaining(byKey: ReadonlyMap<string, IDrapeInstance>, address: ITileAddress): IDrapeInstance | undefined {
    for (let tile: ITileAddress | undefined = address; tile; tile = parentTileAddress(tile)) {
        const leaf = byKey.get(tileAddressKey(tile));
        if (leaf) return leaf;
    }
    return undefined;
}

const EDGE_BITS = new Map<number, number>([
    [TileNeighbor.N, DrapeInstanceEdge.N],
    [TileNeighbor.E, DrapeInstanceEdge.E],
    [TileNeighbor.S, DrapeInstanceEdge.S],
    [TileNeighbor.W, DrapeInstanceEdge.W],
]);

describe("DrapeInstanceCut on the cube index", () => {
    const cut = (terrain: ITileAddress[], imagery: ITileAddress[]): IDrapeInstance[] =>
        new DrapeInstanceCut({ topology: CUBE_TILE_TOPOLOGY, maxDepth: 8 }).update(terrain, imagery, 0);

    it("keeps the tiles of different faces apart", () => {
        const instances = cut(allTiles(0), []);
        expect(instances.map(({ address }) => address.face).sort()).toEqual([0, 1, 2, 3, 4, 5]);
        for (const instance of instances) {
            expect(instance.finerEdges).toBe(0);
            expect(instance.coarserEdges).toBe(0);
        }
    });

    it("balances across a turned face edge", () => {
        // Imagery four levels below face 1 along its north edge, which meets the east edge of face 4, reversed.
        const instances = cut(allTiles(0), [{ face: CubeFace.PositiveY, lod: 4, x: 5, y: 0 }]);
        const byKey = new Map(instances.map((instance) => [tileAddressKey(instance.address), instance]));
        let turned = 0;
        for (const { address } of instances) {
            for (const edge of TILE_EDGE_NEIGHBORS) {
                const neighbor = CUBE_TILE_TOPOLOGY.neighbor(address, edge)!;
                const across = leafContaining(byKey, neighbor.address);
                // No leaf across an edge is more than one level coarser.
                if (across) expect(address.lod - across.address.lod).toBeLessThanOrEqual(1);
                if (across && neighbor.turns !== 0 && across.address.lod !== address.lod) turned++;
            }
        }
        expect(turned).toBeGreaterThan(0);
        // The refinement reached the north face.
        expect(instances.some(({ address }) => address.face === CubeFace.North && address.lod >= 3)).toBe(true);
    });

    it("gives both sides of an edge the same levels and the same heights, across faces", () => {
        const instances = cut(allTiles(1), [
            { face: CubeFace.PositiveY, lod: 4, x: 5, y: 0 },
            { face: CubeFace.North, lod: 3, x: 7, y: 7 },
            { face: CubeFace.South, lod: 3, x: 0, y: 3 },
        ]);
        const byKey = new Map(instances.map((instance) => [tileAddressKey(instance.address), instance]));
        let checked = 0;
        for (const instance of instances) {
            for (const edge of TILE_EDGE_NEIGHBORS) {
                const bit = EDGE_BITS.get(edge)!;
                const neighbor = CUBE_TILE_TOPOLOGY.neighbor(instance.address, edge)!;
                const across = leafContaining(byKey, neighbor.address);
                if (across) {
                    expect((instance.coarserEdges & bit) !== 0).toBe(across.address.lod < instance.address.lod);
                    expect(instance.finerEdges & bit).toBe(0);
                    checked++;
                } else {
                    expect(instance.finerEdges & bit).toBe(bit);
                    expect(instance.coarserEdges & bit).toBe(0);
                }
            }
        }
        expect(checked).toBeGreaterThan(0);
    });

    it("reads corners from 3 tiles at the vertices of the cube", () => {
        // Terrain of different levels around the vertex shared by faces 0, 1 and 4: the north-east corner of face 0.
        const terrain: ITileAddress[] = [];
        for (const tile of allTiles(1)) {
            const atVertex = tile.face === CubeFace.PositiveX && tile.x === 1 && tile.y === 0;
            if (atVertex) terrain.push(...childTileAddresses(tile));
            else terrain.push(tile);
        }
        const instances = cut(terrain, []);
        const vertexTile = instances.find(({ address }) => address.face === CubeFace.PositiveX && address.lod === 2 && address.x === 3 && address.y === 0)!;
        expect(cubeCornerTileCount(vertexTile.address, TileNeighbor.NE)).toBe(3);
        expect(CUBE_TILE_TOPOLOGY.neighbor(vertexTile.address, TileNeighbor.NE)).toBeUndefined();
        const corner = vertexTile.cornerTerrain[TILE_CORNER_NEIGHBORS.indexOf(TileNeighbor.NE)];
        // The coarsest terrain at the vertex lies on one of the two other faces, at level 1.
        expect(corner.lod).toBe(1);
        expect([CubeFace.PositiveY, CubeFace.North]).toContain(corner.face);
    });

    it("finds the finest tile at a corner on another face", () => {
        // Face 4 is refined at its corner that meets the north edge of face 1, off the vertices of the cube.
        const terrain = allTiles(2).filter((tile) => !(tile.face === CubeFace.North && tile.x === 3 && tile.y === 1));
        terrain.push(...childTileAddresses({ face: CubeFace.North, lod: 2, x: 3, y: 1 }));
        const instances = cut(terrain, []);
        // The tile of face 1 touching that refined tile has it across its north edge.
        const neighbor = CUBE_TILE_TOPOLOGY.neighbor({ face: CubeFace.North, lod: 2, x: 3, y: 1 }, TileNeighbor.E)!;
        expect(neighbor.address.face).toBe(CubeFace.PositiveY);
        const leaf = instances.find(({ address }) => tileAddressKey(address) === tileAddressKey(neighbor.address))!;
        expect(leaf.finerEdges & DrapeInstanceEdge.N).toBe(DrapeInstanceEdge.N);
    });

    it("keeps the behaviour of a flat pyramid by default", () => {
        const instances = new DrapeInstanceCut().update([{ lod: 0, x: 0, y: 0 }], [{ lod: 2, x: 3, y: 1 }], 0);
        expect(instances).toHaveLength(7);
    });
});

describe("cubeTileAreaIn", () => {
    /** A point of a tile and the same point read through its area in another tile are the same direction. */
    function expectSamePoint(address: ITileAddress, other: ITileAddress, u: number, v: number): void {
        const area = CUBE_TILE_TOPOLOGY.areaIn(address, other);
        const [a, b] = turnedTileCoordinates(u, v, area.turns);
        const own = cubeTileDirection(address, u, v);
        const theirs = cubeTileDirection(other, area.west + a * area.size, area.north + b * area.size);
        expect(Math.hypot(own.x - theirs.x, own.y - theirs.y, own.z - theirs.z)).toBeLessThan(1e-12);
    }

    it("reads the shared edge of every face edge in the frame of the other tile", () => {
        const lod = 3;
        const last = 7;
        for (let face = 0; face < CUBE_FACE_COUNT; face++) {
            for (const edge of TILE_EDGE_NEIGHBORS) {
                const address: ITileAddress = {
                    face,
                    lod,
                    x: edge === TileNeighbor.W ? 0 : edge === TileNeighbor.E ? last : 2,
                    y: edge === TileNeighbor.N ? 0 : edge === TileNeighbor.S ? last : 2,
                };
                const neighbor = CUBE_TILE_TOPOLOGY.neighbor(address, edge)!;
                for (const t of [0, 0.25, 0.5, 1]) {
                    const u = edge === TileNeighbor.W ? 0 : edge === TileNeighbor.E ? 1 : t;
                    const v = edge === TileNeighbor.N ? 0 : edge === TileNeighbor.S ? 1 : t;
                    // At its own level, and in a coarser tile containing the neighbour.
                    expectSamePoint(address, neighbor.address, u, v);
                    expectSamePoint(address, parentTileAddress(neighbor.address)!, u, v);
                    expectSamePoint(address, parentTileAddress(parentTileAddress(neighbor.address)!)!, u, v);
                }
            }
        }
    });

    it("stays axis-aligned on the same face and rejects opposite faces", () => {
        expect(CUBE_TILE_TOPOLOGY.areaIn({ face: 2, lod: 3, x: 5, y: 2 }, { face: 2, lod: 1, x: 1, y: 0 })).toEqual({ west: 0.25, north: 0.5, size: 0.25, turns: 0 });
        expect(() => CUBE_TILE_TOPOLOGY.areaIn({ face: 0, lod: 1, x: 0, y: 0 }, { face: 2, lod: 1, x: 0, y: 0 })).toThrow(RangeError);
        expect(() => CUBE_TILE_TOPOLOGY.areaIn({ face: 4, lod: 1, x: 0, y: 0 }, { face: 5, lod: 1, x: 0, y: 0 })).toThrow(RangeError);
    });
});
