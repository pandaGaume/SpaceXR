import { NeighborLod } from "@spacexr/grid";
import {
    CUBE_TILE_TOPOLOGY,
    TILE_EDGE_NEIGHBORS,
    TileNeighbor,
    childTileAddresses,
    parentTileAddress,
    tileAddressKey,
    type ITileAddress,
} from "@spacexr/tiles";
import { describe, expect, it } from "vitest";

import { DisplayedTiles } from "../src/terrain/displayed-tiles";

describe("DisplayedTiles", () => {
    function displayed(...keys: string[]): DisplayedTiles {
        const tiles = new DisplayedTiles();
        for (const key of keys) {
            const [lod, x, y] = key.split("/").map(Number);
            tiles.add({ lod: lod!, x: x!, y: y! });
        }
        return tiles;
    }

    it("finds the same level, a coarser ancestor or finer facing children across each edge", () => {
        // Tile 5/10/10, its east neighbour at the same level, its north neighbour's parent,
        // the southern children of nothing, and the eastern children of its west neighbour.
        const tiles = displayed("5/10/10", "5/11/10", "4/5/4", "6/19/20");
        const tile = { lod: 5, x: 10, y: 10 };

        expect(tiles.lodAcross(tile, TileNeighbor.E)).toBe(5);
        expect(tiles.lodAcross(tile, TileNeighbor.N)).toBe(4);
        expect(tiles.lodAcross(tile, TileNeighbor.W)).toBe(6);
        expect(tiles.lodAcross(tile, TileNeighbor.S)).toBeUndefined();
    });

    it("wraps columns around the antimeridian", () => {
        const tiles = displayed("3/7/2");

        expect(tiles.lodAcross({ lod: 3, x: 0, y: 2 }, TileNeighbor.W)).toBe(3);
    });

    it("lets only one tile of a junction adapt", () => {
        const tiles = displayed("5/10/10", "4/5/4", "6/19/20");
        const tile = { lod: 5, x: 10, y: 10 };

        expect(tiles.edgeLods(tile, "fine")).toEqual({
            [TileNeighbor.N]: NeighborLod.Coarser,
            [TileNeighbor.E]: NeighborLod.Same,
            [TileNeighbor.S]: NeighborLod.Same,
            [TileNeighbor.W]: NeighborLod.Same,
        });
        expect(tiles.edgeLods(tile, "coarse")).toEqual({
            [TileNeighbor.N]: NeighborLod.Same,
            [TileNeighbor.E]: NeighborLod.Same,
            [TileNeighbor.S]: NeighborLod.Same,
            [TileNeighbor.W]: NeighborLod.Finer,
        });
    });

    it("clamps neighbours more than one level apart", () => {
        // 3/3/2 is the level 3 ancestor of 6/24/22, the northern neighbour of 6/24/23.
        const tiles = displayed("3/3/2");

        expect(tiles.edgeLods({ lod: 6, x: 24, y: 23 }, "fine")[TileNeighbor.N]).toBe(NeighborLod.Coarser);
    });

    it("counts duplicate presentations", () => {
        const tiles = displayed("5/1/1", "5/1/1");
        tiles.delete({ lod: 5, x: 1, y: 1 });

        expect(tiles.has({ lod: 5, x: 1, y: 1 })).toBe(true);
    });

    it("lists the levels touching a point of a tile, from the coarsest", () => {
        // 4/4/4; its east neighbour is split into 5/10/8 and 5/10/9.
        const tiles = displayed("4/4/4", "5/10/8", "5/10/9");
        const tile = { lod: 4, x: 4, y: 4 };

        expect(tiles.levelsAt(tile, 1, 0.5)).toEqual([4, 5]);
        expect(tiles.levelsAt(tile, 0.5, 0.5)).toEqual([4]);
        // Nothing across its west edge.
        expect(tiles.levelsAt(tile, 0, 0.5)).toEqual([4]);
        expect(tiles.levelsAt({ lod: 5, x: 10, y: 8 }, 0, 0.5)).toEqual([4, 5]);
    });

    it("reads the level across a corner, and finer tiles only when they touch it", () => {
        const tiles = displayed("4/4/4", "5/10/10", "5/11/11");
        const tile = { lod: 4, x: 4, y: 4 };

        // 5/10/10 is the child of 4/5/5 touching the south-east corner of the tile, 5/11/11 is not.
        expect(tiles.lodAcross(tile, TileNeighbor.SE)).toBe(5);
        expect(tiles.levelsAt(tile, 1, 1)).toEqual([4, 5]);

        const apart = displayed("4/4/4", "5/11/11");
        expect(apart.lodAcross(tile, TileNeighbor.SE)).toBeUndefined();
    });

    it("finds levels across the antimeridian", () => {
        const tiles = displayed("2/3/1");

        expect(tiles.levelsAt({ lod: 2, x: 0, y: 1 }, 0, 0.5)).toEqual([2]);
        expect(tiles.lodAcross({ lod: 2, x: 0, y: 1 }, TileNeighbor.W)).toBe(2);
    });

    it("changes its boundary signature only with the levels around a tile", () => {
        const tile = { lod: 4, x: 4, y: 4 };
        const tiles = displayed("4/4/4", "4/5/4");
        const before = tiles.boundarySignature(tile);

        // Apart from the tile.
        tiles.add({ lod: 4, x: 9, y: 9 });
        expect(tiles.boundarySignature(tile)).toBe(before);

        tiles.delete({ lod: 4, x: 5, y: 4 });
        tiles.add({ lod: 5, x: 10, y: 8 });
        expect(tiles.boundarySignature(tile)).not.toBe(before);
    });
});

describe("DisplayedTiles on the cube index", () => {
    const cube = (...tiles: ITileAddress[]): DisplayedTiles => {
        const displayedTiles = new DisplayedTiles({ topology: CUBE_TILE_TOPOLOGY });
        for (const tile of tiles) displayedTiles.add(tile);
        return displayedTiles;
    };

    it("does not mix the same address on two faces", () => {
        const tiles = cube({ face: 0, lod: 2, x: 1, y: 1 });

        expect(tiles.has({ face: 0, lod: 2, x: 1, y: 1 })).toBe(true);
        expect(tiles.has({ face: 3, lod: 2, x: 1, y: 1 })).toBe(false);
    });

    it("reads the level across every edge of a face, across turned edges too", () => {
        for (let face = 0; face < 6; face++) {
            for (const edge of TILE_EDGE_NEIGHBORS) {
                const tile = { face, lod: 1, x: edge === TileNeighbor.E ? 1 : 0, y: edge === TileNeighbor.S ? 1 : 0 };
                const neighbor = CUBE_TILE_TOPOLOGY.neighbor(tile, edge)!;
                expect(neighbor.address.face).not.toBe(face);

                expect(cube(tile, neighbor.address).lodAcross(tile, edge)).toBe(1);
                expect(cube(tile, parentTileAddress(neighbor.address)!).lodAcross(tile, edge)).toBe(0);
                // The two children of the neighbour facing the tile, and not the two others.
                const children = childTileAddresses(neighbor.address);
                // They are the neighbours of the children of the tile, across the same edge.
                const facing = new Set(
                    childTileAddresses(tile)
                        .map((child) => CUBE_TILE_TOPOLOGY.neighbor(child, edge)!.address)
                        .filter((across) => across.face !== face)
                        .map(tileAddressKey),
                );
                expect(facing.size).toBe(2);
                for (const child of children) {
                    expect(cube(tile, child).lodAcross(tile, edge)).toBe(facing.has(tileAddressKey(child)) ? 2 : undefined);
                }
            }
        }
    });

    it("keeps a ghost when a tile with the same address appears on another face", () => {
        const tiles = cube({ face: 0, lod: 2, x: 1, y: 1 });
        tiles.hide({ face: 0, lod: 2, x: 1, y: 1 });
        expect(tiles.isGhost({ face: 0, lod: 2, x: 1, y: 1 })).toBe(true);

        tiles.add({ face: 3, lod: 2, x: 1, y: 1 });
        tiles.add({ face: 3, lod: 3, x: 2, y: 2 });
        expect(tiles.isGhost({ face: 0, lod: 2, x: 1, y: 1 })).toBe(true);
        expect(tiles.has({ face: 0, lod: 2, x: 1, y: 1 })).toBe(true);
    });

    it("has no corner tile at a vertex of the cube, where 3 tiles meet", () => {
        const tile = { face: 0, lod: 0, x: 0, y: 0 };
        const tiles = cube(
            tile,
            CUBE_TILE_TOPOLOGY.neighbor(tile, TileNeighbor.N)!.address,
            CUBE_TILE_TOPOLOGY.neighbor(tile, TileNeighbor.W)!.address,
        );

        expect(tiles.lodAcross(tile, TileNeighbor.NW)).toBeUndefined();
        expect(tiles.levelsAt(tile, 0, 0)).toEqual([0]);
    });
});

describe("DisplayedTiles ghosts", () => {
    const tile = (lod: number, x: number, y: number) => ({ lod, x, y });

    it("keeps a tile hidden outside the view as a ghost its neighbours still connect to", () => {
        const tiles = new DisplayedTiles();
        tiles.add(tile(3, 3, 2));
        tiles.add(tile(2, 2, 1));
        tiles.hide(tile(2, 2, 1));

        expect(tiles.isGhost(tile(2, 2, 1))).toBe(true);
        expect(tiles.lodAcross(tile(3, 3, 2), TileNeighbor.E)).toBe(2);
    });

    it("forgets a hidden tile that a displayed tile overlaps", () => {
        const tiles = new DisplayedTiles();
        tiles.add(tile(3, 4, 2));
        tiles.add(tile(2, 2, 1));
        tiles.hide(tile(2, 2, 1));

        expect(tiles.has(tile(2, 2, 1))).toBe(false);
    });

    it("drops a ghost when a tile overlapping it is presented, or when it is released", () => {
        const tiles = new DisplayedTiles();
        tiles.add(tile(2, 2, 1));
        tiles.hide(tile(2, 2, 1));
        tiles.add(tile(3, 5, 3));
        expect(tiles.has(tile(2, 2, 1))).toBe(false);

        tiles.add(tile(2, 0, 0));
        tiles.hide(tile(2, 0, 0));
        tiles.delete(tile(2, 0, 0));
        expect(tiles.has(tile(2, 0, 0))).toBe(false);
        expect(tiles.lodAcross(tile(2, 1, 0), TileNeighbor.W)).toBeUndefined();
    });

    it("presents a ghost again as a displayed tile", () => {
        const tiles = new DisplayedTiles();
        tiles.add(tile(2, 1, 1));
        tiles.hide(tile(2, 1, 1));
        tiles.add(tile(2, 1, 1));

        expect(tiles.isGhost(tile(2, 1, 1))).toBe(false);
        tiles.delete(tile(2, 1, 1));
        expect(tiles.has(tile(2, 1, 1))).toBe(false);
    });
});
