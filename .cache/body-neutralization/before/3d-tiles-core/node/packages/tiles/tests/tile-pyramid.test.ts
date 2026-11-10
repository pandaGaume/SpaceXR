import { describe, expect, it, vi } from "vitest";

import { TileNeighbor, TilePyramid, tileAreaInAncestor, type ITileAddress } from "../src";

const key = (address: ITileAddress) => `${address.lod}/${address.x}/${address.y}`;

function recordingLoader(missing: readonly string[] = []) {
    const loads: string[] = [];
    const load = (address: ITileAddress) => {
        loads.push(key(address));
        return Promise.resolve(missing.includes(key(address)) ? undefined : key(address));
    };
    return { loads, load };
}

describe("tileAreaInAncestor", () => {
    it("locates a tile in its ancestor", () => {
        expect(tileAreaInAncestor({ lod: 3, x: 5, y: 2 }, 2)).toEqual({ ancestor: { lod: 1, x: 1, y: 0 }, west: 0.25, north: 0.5, size: 0.25 });
        expect(tileAreaInAncestor({ lod: 3, x: 5, y: 2 }, 0)).toEqual({ ancestor: { lod: 3, x: 5, y: 2 }, west: 0, north: 0, size: 1 });
    });
});

describe("TilePyramid withdrawing requests", () => {
    function pendingLoader() {
        const signals: AbortSignal[] = [];
        const finish: Array<(content: string) => void> = [];
        const load = (_address: ITileAddress, signal?: AbortSignal) => {
            signals.push(signal!);
            return new Promise<string | undefined>((resolve) => finish.push(resolve));
        };
        return { signals, finish, load };
    }
    const tile = { lod: 2, x: 1, y: 1 };

    it("aborts a load and forgets it when the only request withdraws", async () => {
        const { signals, load } = pendingLoader();
        const pyramid = new TilePyramid({ load, maxLOD: 4 });
        const controller = new AbortController();
        const request = pyramid.load(tile, controller.signal);

        controller.abort();
        await expect(request).rejects.toBeDefined();
        expect(signals[0]!.aborted).toBe(true);
        expect(pyramid.size).toBe(0);

        void pyramid.load(tile);
        expect(signals).toHaveLength(2);
    });

    it("goes on for the other requests, which are not disturbed", async () => {
        const { signals, finish, load } = pendingLoader();
        const pyramid = new TilePyramid({ load, maxLOD: 4 });
        const first = new AbortController();
        const second = new AbortController();
        const leaving = pyramid.load(tile, first.signal);
        const staying = pyramid.load(tile, second.signal);

        first.abort();
        await expect(leaving).rejects.toBeDefined();
        expect(signals[0]!.aborted).toBe(false);

        finish[0]!("content");
        expect((await staying)?.content).toBe("content");
        expect(pyramid.size).toBe(1);
    });

    it("never aborts a load a request without a signal waits for", async () => {
        const { signals, finish, load } = pendingLoader();
        const pyramid = new TilePyramid({ load, maxLOD: 4 });
        const controller = new AbortController();
        const leaving = pyramid.load(tile, controller.signal);
        const pinned = pyramid.load(tile);

        controller.abort();
        await expect(leaving).rejects.toBeDefined();
        expect(signals[0]!.aborted).toBe(false);
        finish[0]!("content");
        expect((await pinned)?.content).toBe("content");
    });

    it("waits before aborting, and goes on if the tile comes back in the meantime", async () => {
        vi.useFakeTimers();
        try {
            const { signals, finish, load } = pendingLoader();
            const pyramid = new TilePyramid({ load, maxLOD: 4, abortDelayMilliseconds: 500 });
            const controller = new AbortController();
            const leaving = pyramid.load(tile, controller.signal);
            controller.abort();
            await expect(leaving).rejects.toBeDefined();

            vi.advanceTimersByTime(499);
            expect(signals[0]!.aborted).toBe(false);
            const back = pyramid.load(tile);
            vi.advanceTimersByTime(1000);
            expect(signals[0]!.aborted).toBe(false);
            expect(signals).toHaveLength(1);

            finish[0]!("content");
            expect((await back)?.content).toBe("content");
        } finally {
            vi.useRealTimers();
        }
    });

    it("aborts once the delay has passed without a new request", async () => {
        vi.useFakeTimers();
        try {
            const { signals, load } = pendingLoader();
            const pyramid = new TilePyramid({ load, maxLOD: 4, abortDelayMilliseconds: 500 });
            const controller = new AbortController();
            const leaving = pyramid.load(tile, controller.signal);
            controller.abort();
            await expect(leaving).rejects.toBeDefined();

            vi.advanceTimersByTime(500);
            expect(signals[0]!.aborted).toBe(true);
            expect(pyramid.size).toBe(0);
        } finally {
            vi.useRealTimers();
        }
    });

    it("keeps a loaded tile when a request withdraws afterwards", async () => {
        const { finish, load } = pendingLoader();
        const pyramid = new TilePyramid({ load, maxLOD: 4 });
        const controller = new AbortController();
        const request = pyramid.load(tile, controller.signal);
        finish[0]!("content");
        await request;

        controller.abort();
        expect(pyramid.get(tile)).toBe("content");
    });
});

describe("TilePyramid", () => {
    it("serves a tile from the deepest level at its place, in a pyramid of varying depth", async () => {
        const { loads, load } = recordingLoader();
        const pyramid = new TilePyramid({ load, maxLOD: 4, servingLevel: (address) => (address.x < 2 ** (address.lod - 1) ? address.lod : Math.min(address.lod, 1)) });
        expect(pyramid.areaOf({ lod: 3, x: 1, y: 0 }).ancestor).toEqual({ lod: 3, x: 1, y: 0 });
        expect(pyramid.areaOf({ lod: 3, x: 6, y: 0 })).toEqual({ ancestor: { lod: 1, x: 1, y: 0 }, west: 0.5, north: 0, size: 0.25 });
        // Never deeper than the pyramid.
        expect(pyramid.areaOf({ lod: 6, x: 0, y: 0 }).ancestor.lod).toBe(4);
        const region = await pyramid.load({ lod: 3, x: 6, y: 0 });
        expect(region?.content).toBe("1/1/0");
        expect(loads).toEqual(["1/1/0"]);
    });

    it("loads each tile once and serves deeper tiles from their ancestor", async () => {
        const { loads, load } = recordingLoader();
        const pyramid = new TilePyramid({ load, maxLOD: 2 });
        const [first, second] = await Promise.all([pyramid.load({ lod: 2, x: 1, y: 1 }), pyramid.load({ lod: 4, x: 5, y: 6 })]);
        expect(loads).toEqual(["2/1/1"]);
        expect(first).toMatchObject({ content: "2/1/1", west: 0, north: 0, size: 1 });
        expect(second).toMatchObject({ address: { lod: 4, x: 5, y: 6 }, ancestor: { lod: 2, x: 1, y: 1 }, west: 0.25, north: 0.5, size: 0.25 });
        expect(pyramid.get({ lod: 2, x: 1, y: 1 })).toBe("2/1/1");
    });

    it("prefetches neighbours, wrapping the antimeridian, and ignores missing or failing ones", async () => {
        const loads: string[] = [];
        const load = (address: ITileAddress) => {
            loads.push(key(address));
            if (key(address) === "1/0/1") return Promise.reject(new Error("offline"));
            return Promise.resolve(key(address));
        };
        const pyramid = new TilePyramid({ load, maxLOD: 3, wrapX: true, prefetch: [TileNeighbor.E, TileNeighbor.S, TileNeighbor.SE] });
        const region = await pyramid.load({ lod: 1, x: 1, y: 0 });
        expect(region?.content).toBe("1/1/0");
        expect(loads).toEqual(["1/1/0", "1/0/0", "1/1/1", "1/0/1"]);
        // A failed load leaves the cache so that it can be retried.
        expect(pyramid.size).toBe(3);
        // The south neighbour of the last row does not exist.
        loads.length = 0;
        await pyramid.load({ lod: 1, x: 1, y: 1 });
        expect(loads).toEqual(["1/0/1"]);
    });

    it("returns undefined for absent tiles", async () => {
        const { load } = recordingLoader(["0/0/0"]);
        const pyramid = new TilePyramid({ load, maxLOD: 0 });
        expect(await pyramid.load({ lod: 0, x: 0, y: 0 })).toBeUndefined();
        expect(pyramid.get({ lod: 0, x: 0, y: 0 })).toBeUndefined();
    });

    it("evicts the least recently used tiles and reports loads and evictions", async () => {
        const { loads, load } = recordingLoader();
        const loaded: string[] = [];
        const evicted: string[] = [];
        const pyramid = new TilePyramid({
            load,
            maxLOD: 5,
            cacheEntries: 2,
            onLoad: (address) => loaded.push(key(address)),
            onEvict: (address) => evicted.push(key(address)),
        });
        await pyramid.load({ lod: 1, x: 0, y: 0 });
        await pyramid.load({ lod: 1, x: 1, y: 0 });
        await pyramid.load({ lod: 1, x: 0, y: 0 });
        await pyramid.load({ lod: 1, x: 0, y: 1 });
        expect(evicted).toEqual(["1/1/0"]);
        expect(loaded).toEqual(["1/0/0", "1/1/0", "1/0/1"]);
        await pyramid.load({ lod: 1, x: 1, y: 0 });
        expect(loads).toEqual(["1/0/0", "1/1/0", "1/0/1", "1/1/0"]);
    });

    it("drops a tile evicted while it loads", async () => {
        let resolve!: (value: string) => void;
        const loaded: string[] = [];
        const pyramid = new TilePyramid<string>({
            load: () => new Promise((settle) => (resolve = settle)),
            maxLOD: 1,
            onLoad: (address) => loaded.push(key(address)),
        });
        const loading = pyramid.load({ lod: 0, x: 0, y: 0 });
        expect(pyramid.delete({ lod: 0, x: 0, y: 0 })).toBe(true);
        resolve("late");
        expect((await loading)?.content).toBe("late");
        expect(loaded).toEqual([]);
        expect(pyramid.get({ lod: 0, x: 0, y: 0 })).toBeUndefined();
    });

    it("rejects an invalid maxLOD", () => {
        expect(() => new TilePyramid({ load: () => Promise.resolve(undefined), maxLOD: -1 })).toThrow(RangeError);
    });
});

describe("TilePyramid retention", () => {
    it("never evicts retained tiles, and evicts them like others once released", async () => {
        const evicted: string[] = [];
        const pyramid = new TilePyramid<string>({
            load: (address) => Promise.resolve(`${address.lod}/${address.x}/${address.y}`),
            maxLOD: 4,
            cacheEntries: 2,
            onEvict: (address) => evicted.push(`${address.lod}/${address.x}/${address.y}`),
        });
        // Deeper tiles retain the pyramid tile serving them.
        pyramid.retain({ lod: 6, x: 0, y: 0 });
        await pyramid.load({ lod: 4, x: 0, y: 0 });
        await pyramid.load({ lod: 4, x: 1, y: 0 });
        await pyramid.load({ lod: 4, x: 2, y: 0 });
        await pyramid.load({ lod: 4, x: 3, y: 0 });

        expect(pyramid.get({ lod: 4, x: 0, y: 0 })).toBe("4/0/0");
        expect(evicted).toEqual(["4/1/0", "4/2/0"]);

        // Released, the least recently used tile is evicted first once the cache overflows.
        pyramid.release({ lod: 6, x: 0, y: 0 });
        expect(pyramid.size).toBe(2);
        await pyramid.load({ lod: 4, x: 4, y: 0 });
        expect(evicted).toEqual(["4/1/0", "4/2/0", "4/0/0"]);
    });
});
