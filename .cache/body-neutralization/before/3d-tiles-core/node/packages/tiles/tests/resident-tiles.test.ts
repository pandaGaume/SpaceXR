import { describe, expect, it } from "vitest";

import { ResidentTiles } from "../src";

describe("ResidentTiles", () => {
    it("covers a tile with the deepest resident tile containing it", () => {
        const pages = new ResidentTiles<string>();
        pages.set({ lod: 1, x: 0, y: 0 }, "1/0/0");
        pages.set({ lod: 3, x: 1, y: 2 }, "3/1/2");

        expect(pages.cover({ lod: 3, x: 1, y: 2 })).toEqual({ ancestor: { lod: 3, x: 1, y: 2 }, west: 0, north: 0, size: 1, value: "3/1/2" });
        expect(pages.cover({ lod: 4, x: 3, y: 5 })).toMatchObject({ value: "3/1/2", west: 0.5, north: 0.5, size: 0.5 });
        expect(pages.cover({ lod: 3, x: 0, y: 1 })).toMatchObject({ value: "1/0/0", west: 0, north: 0.25, size: 0.25 });
    });

    it("finds nothing outside resident tiles or above the coarsest level searched", () => {
        const pages = new ResidentTiles<number>();
        pages.set({ lod: 1, x: 0, y: 0 }, 7);

        expect(pages.cover({ lod: 2, x: 3, y: 0 })).toBeUndefined();
        expect(pages.cover({ lod: 3, x: 0, y: 0 }, 2)).toBeUndefined();
        expect(pages.cover({ lod: 3, x: 0, y: 0 }, 1)?.value).toBe(7);
    });

    it("measures how deep resident tiles reach inside a tile", () => {
        const tiles = new ResidentTiles<boolean>();
        tiles.set({ lod: 2, x: 1, y: 1 }, true);
        tiles.set({ lod: 5, x: 9, y: 8 }, true);
        tiles.set({ lod: 6, x: 0, y: 0 }, true);

        expect(tiles.depthWithin({ lod: 2, x: 1, y: 1 })).toBe(3);
        expect(tiles.depthWithin({ lod: 2, x: 1, y: 1 }, 2)).toBe(0);
        expect(tiles.depthWithin({ lod: 3, x: 3, y: 3 })).toBeUndefined();
        expect([...tiles.addresses()]).toHaveLength(3);
    });

    it("stores, replaces and forgets tiles", () => {
        const pages = new ResidentTiles<number>();
        pages.set({ lod: 0, x: 0, y: 0 }, 1);
        pages.set({ lod: 0, x: 0, y: 0 }, 2);

        expect(pages.size).toBe(1);
        expect(pages.get({ lod: 0, x: 0, y: 0 })).toBe(2);
        expect(pages.delete({ lod: 0, x: 0, y: 0 })).toBe(true);
        expect(pages.has({ lod: 0, x: 0, y: 0 })).toBe(false);
    });
});
