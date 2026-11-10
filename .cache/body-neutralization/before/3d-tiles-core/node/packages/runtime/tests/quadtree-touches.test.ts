import { describe, expect, it } from "vitest";

import { quadtreeTileKey, quadtreeTouches } from "../src/runtime/quadtree-balance";

const at = (lod: number, x: number, y: number) => ({ namespace: "", address: { lod, x, y }, wrapX: false });
const visible = (...tiles: [number, number, number][]) => new Set(tiles.map(([lod, x, y]) => quadtreeTileKey("", { lod, x, y })));

describe("quadtreeTouches", () => {
    // A visible tile of level 3, at column 4 and row 4.
    const tile = visible([3, 4, 4]);

    it("takes the tiles of its level that touch it, by an edge or a corner", () => {
        expect(quadtreeTouches(at(3, 5, 4), tile)).toBe(true);
        expect(quadtreeTouches(at(3, 4, 3), tile)).toBe(true);
        expect(quadtreeTouches(at(3, 5, 5), tile)).toBe(true);
    });

    it("takes the finer tiles that touch it, at any depth", () => {
        // The western column of the tile to the east, at level 4 and level 6.
        expect(quadtreeTouches(at(4, 10, 8), tile)).toBe(true);
        expect(quadtreeTouches(at(6, 40, 35), tile)).toBe(true);
        // The corner of the tile to the south-east.
        expect(quadtreeTouches(at(5, 20, 20), tile)).toBe(true);
    });

    it("leaves the finer tiles of a neighbour that do not touch it", () => {
        expect(quadtreeTouches(at(4, 11, 8), tile)).toBe(false);
        expect(quadtreeTouches(at(6, 41, 35), tile)).toBe(false);
    });

    it("leaves the tiles of its level that do not touch it, and the coarser ones that do", () => {
        expect(quadtreeTouches(at(3, 6, 4), tile)).toBe(false);
        expect(quadtreeTouches(at(2, 3, 2), tile)).toBe(false);
    });

    it("does not count the tile itself", () => {
        expect(quadtreeTouches(at(3, 4, 4), tile)).toBe(false);
    });

    it("finds nothing among no tiles", () => {
        expect(quadtreeTouches(at(3, 5, 4), visible())).toBe(false);
    });
});
