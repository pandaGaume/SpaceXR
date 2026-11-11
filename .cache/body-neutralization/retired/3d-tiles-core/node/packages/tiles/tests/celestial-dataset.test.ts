import { describe, expect, it, vi } from "vitest";

import { CELESTIAL_CUBE_SCHEME, CelestialTileSource, CubeFace, TileHttpClient, parseCelestialDataset } from "../src";

const LOLA = {
    scheme: "spacexr-cube-equiangular/1",
    body: "Moon",
    frame: "MOON_ME",
    referenceRadii: [1737400, 1737400, 1737400],
    content: "elevation",
    encoding: "terrarium",
    tileSize: 256,
    minLOD: 0,
    maxLOD: 7,
    subtrees: [{ face: 5, lod: 0, x: 0, y: 0, maxLOD: 11 }],
    tiles: "https://tiles.example.com/moon/lola/{face}/{z}/{x}/{y}.png",
};

describe("parseCelestialDataset", () => {
    it("accepts the descriptor of the specification", () => {
        expect(parseCelestialDataset(LOLA)).toEqual(LOLA);
        expect(LOLA.scheme).toBe(CELESTIAL_CUBE_SCHEME);
        expect(parseCelestialDataset({ ...LOLA, subtrees: undefined }).subtrees).toEqual([]);
    });

    it.each([
        ["scheme", { scheme: "spacexr-cube-equiangular/2" }, "not supported"],
        ["body", { body: "" }, "body"],
        ["frame", { frame: 3 }, "frame"],
        ["two radii", { referenceRadii: [1, 2] }, "referenceRadii"],
        ["negative radius", { referenceRadii: [1737400, -1, 1737400] }, "referenceRadii"],
        ["content", { content: "vector" }, "content"],
        ["encoding", { encoding: undefined }, "encoding"],
        ["tileSize", { tileSize: 0 }, "tileSize"],
        ["minLOD", { minLOD: -1 }, "minLOD"],
        ["level order", { minLOD: 8 }, "must not exceed"],
        ["subtrees", { subtrees: {} }, "subtrees"],
        ["subtree face", { subtrees: [{ face: 6, lod: 0, x: 0, y: 0, maxLOD: 3 }] }, "subtree"],
        ["subtree without face", { subtrees: [{ lod: 0, x: 0, y: 0, maxLOD: 3 }] }, "subtree"],
        ["subtree outside its level", { subtrees: [{ face: 1, lod: 1, x: 2, y: 0, maxLOD: 3 }] }, "subtree"],
        ["subtree levels", { subtrees: [{ face: 1, lod: 4, x: 0, y: 0, maxLOD: 3 }] }, "maxLOD"],
    ])("rejects an invalid %s", (_name, change, message) => {
        expect(() => parseCelestialDataset({ ...LOLA, ...change })).toThrow(message);
    });

    it("rejects other values and unknown URL variables", () => {
        expect(() => parseCelestialDataset(null)).toThrow(RangeError);
        expect(() => parseCelestialDataset([])).toThrow(RangeError);
        expect(() => parseCelestialDataset({ ...LOLA, tiles: "https://x/{unknown}" })).toThrow("unknown");
    });
});

describe("CelestialTileSource", () => {
    it("declares availability from the levels and subtrees", () => {
        const source = new CelestialTileSource(LOLA);
        expect(source.deepestLOD).toBe(11);
        expect(source.isAvailable({ face: 2, lod: 7, x: 100, y: 3 })).toBe(true);
        expect(source.isAvailable({ face: 2, lod: 8, x: 100, y: 3 })).toBe(false);
        expect(source.isAvailable({ face: CubeFace.South, lod: 11, x: 1024, y: 1023 })).toBe(true);
        expect(source.isAvailable({ face: CubeFace.South, lod: 12, x: 0, y: 0 })).toBe(false);
        expect(source.isAvailable({ face: 6, lod: 0, x: 0, y: 0 })).toBe(false);

        const partial = new CelestialTileSource({ ...LOLA, minLOD: 2, maxLOD: 3, subtrees: [{ face: 1, lod: 2, x: 1, y: 1, maxLOD: 6 }] });
        expect(partial.isAvailable({ face: 1, lod: 1, x: 0, y: 0 })).toBe(false);
        expect(partial.isAvailable({ face: 1, lod: 6, x: 16, y: 31 })).toBe(true);
        expect(partial.isAvailable({ face: 1, lod: 6, x: 32, y: 31 })).toBe(false);
        expect(partial.isAvailable({ face: 2, lod: 6, x: 16, y: 31 })).toBe(false);
    });

    it("gives the deepest level at the place of a tile", () => {
        const source = new CelestialTileSource({
            ...LOLA,
            maxLOD: 2,
            subtrees: [
                { face: 5, lod: 3, x: 0, y: 0, maxLOD: 3 },
                { face: 5, lod: 4, x: 1, y: 1, maxLOD: 5 },
            ],
        });
        // Everywhere.
        expect(source.servingLevel({ face: 1, lod: 1, x: 0, y: 0 })).toBe(1);
        expect(source.servingLevel({ face: 1, lod: 9, x: 0, y: 0 })).toBe(2);
        // Inside the subtrees, at any depth.
        expect(source.servingLevel({ face: 5, lod: 3, x: 0, y: 0 })).toBe(3);
        expect(source.servingLevel({ face: 5, lod: 4, x: 0, y: 0 })).toBe(3);
        expect(source.servingLevel({ face: 5, lod: 4, x: 1, y: 1 })).toBe(4);
        expect(source.servingLevel({ face: 5, lod: 9, x: 32, y: 32 })).toBe(5);
        // Beside them.
        expect(source.servingLevel({ face: 5, lod: 3, x: 7, y: 7 })).toBe(2);
        expect(source.isAvailable({ face: 5, lod: 4, x: 0, y: 0 })).toBe(false);
        expect(source.isAvailable({ face: 5, lod: 4, x: 1, y: 1 })).toBe(true);
    });

    it("places its tiles on the declared reference surface", () => {
        const { surface } = new CelestialTileSource({ ...LOLA, referenceRadii: [13000, 11400, 9100] });
        expect(surface.reference.radii).toEqual([13000, 11400, 9100]);
        expect(surface.point({ face: CubeFace.North, lod: 0, x: 0, y: 0 }, 0.5, 0.5).z).toBeCloseTo(9100, 9);
    });

    it("requests only what the dataset declares", async () => {
        const client = new TileHttpClient();
        const fetchTile = vi.spyOn(client, "fetchTile").mockResolvedValue({ status: "absent", url: "", httpStatus: 404 });
        const source = new CelestialTileSource(LOLA, { client });
        expect(await source.fetchTile({ face: 2, lod: 9, x: 0, y: 0 })).toEqual({ status: "absent", url: "https://tiles.example.com/moon/lola/2/9/0/0.png", httpStatus: 404 });
        expect(fetchTile).not.toHaveBeenCalled();
        await source.fetchTile({ face: 5, lod: 9, x: 3, y: 4 });
        expect(fetchTile).toHaveBeenCalledWith("https://tiles.example.com/moon/lola/5/9/3/4.png", undefined);
    });
});
