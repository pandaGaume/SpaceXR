import { ResidentTiles } from "@spacexr/tiles";
import { describe, expect, it } from "vitest";

import { drapeCells, drapeDepth, pageAffectsDrape } from "../src";

describe("drapeCells", () => {
    it("uses the finer page of each cell and falls back to coarser pages elsewhere", () => {
        const pages = new ResidentTiles<number>();
        pages.set({ lod: 2, x: 1, y: 1 }, 10); // the terrain tile itself
        pages.set({ lod: 3, x: 2, y: 2 }, 20); // its north-west quadrant
        pages.set({ lod: 4, x: 6, y: 4 }, 30); // two levels finer, in the north-east quadrant

        const [northWest, northEast, southWest, southEast] = drapeCells(pages, { lod: 2, x: 1, y: 1 }, 1);
        expect(northWest).toMatchObject({ value: 20, west: 0, north: 0, size: 1 });
        expect(northEast).toMatchObject({ value: 10, west: 0.5, north: 0, size: 0.5 });
        expect(southWest).toMatchObject({ value: 10, west: 0, north: 0.5, size: 0.5 });
        expect(southEast).toMatchObject({ value: 10, west: 0.5, north: 0.5, size: 0.5 });

        const cells = drapeCells(pages, { lod: 2, x: 1, y: 1 }, 2);
        expect(cells).toHaveLength(16);
        // Row 0, column 2: tile 4/6/4.
        expect(cells[2]).toMatchObject({ value: 30, size: 1 });
        expect(cells[0]).toMatchObject({ value: 20, west: 0, north: 0, size: 0.5 });
        expect(cells[15]).toMatchObject({ value: 10, west: 0.75, north: 0.75, size: 0.25 });
    });

    it("drapes a single cell from an ancestor page and leaves uncovered cells empty", () => {
        const pages = new ResidentTiles<number>();
        pages.set({ lod: 1, x: 0, y: 0 }, 1);

        expect(drapeCells(pages, { lod: 2, x: 1, y: 0 }, 0)).toEqual([{ ancestor: { lod: 1, x: 0, y: 0 }, west: 0.5, north: 0, size: 0.5, value: 1 }]);
        expect(drapeCells(pages, { lod: 2, x: 2, y: 0 }, 1)).toEqual([undefined, undefined, undefined, undefined]);
        expect(() => drapeCells(pages, { lod: 2, x: 2, y: 0 }, -1)).toThrow(RangeError);
    });
});

describe("drapeDepth", () => {
    it("follows the deepest imagery tile presented inside the terrain tile, up to the maximum depth", () => {
        const cut = new ResidentTiles<true>();
        cut.set({ lod: 1, x: 0, y: 0 }, true); // coarser than the terrain tile
        expect(drapeDepth(cut, { lod: 3, x: 0, y: 0 }, 4)).toBe(0);

        cut.set({ lod: 5, x: 1, y: 2 }, true);
        cut.set({ lod: 9, x: 16, y: 32 }, true);
        expect(drapeDepth(cut, { lod: 3, x: 0, y: 0 }, 4)).toBe(2);
        expect(drapeDepth(cut, { lod: 3, x: 0, y: 0 }, 6)).toBe(6);
        expect(drapeDepth(cut, { lod: 3, x: 1, y: 0 }, 4)).toBe(0);
    });
});

describe("pageAffectsDrape", () => {
    it("selects pages overlapping the terrain tile at most the maximum depth finer", () => {
        const terrain = { lod: 2, x: 1, y: 1 };
        expect(pageAffectsDrape({ lod: 0, x: 0, y: 0 }, terrain)).toBe(true);
        expect(pageAffectsDrape({ lod: 2, x: 1, y: 1 }, terrain)).toBe(true);
        expect(pageAffectsDrape({ lod: 3, x: 3, y: 2 }, terrain)).toBe(true);
        expect(pageAffectsDrape({ lod: 3, x: 4, y: 2 }, terrain)).toBe(false);
        expect(pageAffectsDrape({ lod: 4, x: 4, y: 4 }, terrain)).toBe(false);
        expect(pageAffectsDrape({ lod: 4, x: 4, y: 4 }, terrain, 2)).toBe(true);
        expect(pageAffectsDrape({ lod: 1, x: 1, y: 0 }, terrain)).toBe(false);
    });
});
