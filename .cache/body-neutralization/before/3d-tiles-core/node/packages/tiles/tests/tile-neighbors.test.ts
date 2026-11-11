import { describe, expect, it } from "vitest";

import { TILE_CORNER_EDGES, TileNeighbor, tileNeighborAddress, tileNeighborAddresses, tileNeighborOffset } from "../src";

describe("tile neighbours", () => {
    it("follows the SpaceXR 3 x 3 layout in XYZ axes", () => {
        expect(tileNeighborOffset(TileNeighbor.NW)).toEqual([-1, -1]);
        expect(tileNeighborOffset(TileNeighbor.N)).toEqual([0, -1]);
        expect(tileNeighborOffset(TileNeighbor.E)).toEqual([1, 0]);
        expect(tileNeighborOffset(TileNeighbor.C)).toEqual([0, 0]);
        expect(tileNeighborOffset(TileNeighbor.SW)).toEqual([-1, 1]);
        expect(tileNeighborOffset(TileNeighbor.SE)).toEqual([1, 1]);
        expect(TILE_CORNER_EDGES[TileNeighbor.SW]).toEqual([TileNeighbor.S, TileNeighbor.W]);
    });

    it("returns the nine addresses at the same level, the tile itself at the centre", () => {
        const address = { lod: 3, x: 4, y: 2 };
        const neighbors = tileNeighborAddresses(address);

        expect(neighbors[TileNeighbor.C]).toEqual(address);
        expect(neighbors[TileNeighbor.N]).toEqual({ lod: 3, x: 4, y: 1 });
        expect(neighbors[TileNeighbor.SE]).toEqual({ lod: 3, x: 5, y: 3 });
        expect(neighbors[TileNeighbor.W]).toEqual({ lod: 3, x: 3, y: 2 });
    });

    it("stops at the pyramid edges unless columns wrap around the antimeridian", () => {
        const corner = { lod: 2, x: 0, y: 0 };

        expect(tileNeighborAddress(corner, TileNeighbor.N)).toBeUndefined();
        expect(tileNeighborAddress(corner, TileNeighbor.W)).toBeUndefined();
        expect(tileNeighborAddress(corner, TileNeighbor.W, { wrapX: true })).toEqual({ lod: 2, x: 3, y: 0 });
        expect(tileNeighborAddress(corner, TileNeighbor.NW, { wrapX: true })).toBeUndefined();
        expect(tileNeighborAddress({ lod: 2, x: 3, y: 3 }, TileNeighbor.E, { wrapX: true })).toEqual({ lod: 2, x: 0, y: 3 });
        expect(tileNeighborAddress({ lod: 0, x: 0, y: 0 }, TileNeighbor.E, { wrapX: true })).toEqual({ lod: 0, x: 0, y: 0 });
    });
});
