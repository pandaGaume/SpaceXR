import { describe, expect, it } from "vitest";

import { createMapzenNormalsSource, decodeMapzenNormalPixels, decodeMapzenNormals, decodeMapzenNormalTile } from "../src";

const bytes = new Uint8Array(
    Buffer.from(
        "iVBORw0KGgoAAAANSUhEUgAAAAQAAAABCAYAAAD5PA/NAAAABGdBTUEAAYagMeiWXwAAAANJREFUeJxjqmeCvgAAABFJREFUaGj4L/K/oUGtgQEIgRwAQtCdCToeAAAAAklEQVQHuPYAEMMAAAAASUVORK5CYII=",
        "base64"
    )
);

describe("Mapzen provider normals", () => {
    it("decodes normalized RGB/128-1 vectors and ignores quantized elevation alpha, including zero", async () => {
        const grid = await decodeMapzenNormalTile(bytes);
        expect(grid.width).toBe(4);
        expect(grid.height).toBe(1);
        expect(grid.channels).toBe(3);
        expect(grid.data.slice(0, 9)).toEqual(new Float32Array([0, 0, 1, 1, 0, 0, 0, -1, 0]));
        expect([...grid.data.slice(9)].every(Number.isNaN)).toBe(true);
    });

    it("normalizes oblique vectors and returns an exact independent RGB copy for GPU pages", () => {
        const image = { width: 2, height: 1, channels: 4 as const, data: new Uint8Array([190, 61, 249, 20, 190, 61, 249, 38]) };
        const pixels = decodeMapzenNormalPixels(image);
        expect(pixels).toEqual({ width: 2, height: 1, channels: 3, data: new Uint8Array([190, 61, 249, 190, 61, 249]) });
        const normals = decodeMapzenNormals(image);
        expect(normals.data.slice(0, 3)).toEqual(normals.data.slice(3));
        expect(Math.hypot(...normals.data.slice(0, 3))).toBeCloseTo(1, 7);
        const length = Math.hypot(190 / 128 - 1, 61 / 128 - 1, 249 / 128 - 1);
        expect(normals.data[0]).toBeCloseTo((190 / 128 - 1) / length, 7);
        image.data.fill(0);
        expect(pixels.data[0]).toBe(190);
    });

    it("rejects malformed RGBA buffers", () => {
        const image = { width: 2, height: 1, channels: 4 as const, data: new Uint8Array(4) };
        expect(() => decodeMapzenNormalPixels(image)).toThrow(RangeError);
        expect(() => decodeMapzenNormals(image)).toThrow(RangeError);
    });

    it("uses its independent physical source through L15 and reports missing normal tiles as absent", async () => {
        const urls: string[] = [];
        const source = createMapzenNormalsSource({
            client: {
                fetch: async (url) => {
                    urls.push(url);
                    return new Response(undefined, { status: 404 });
                },
            },
        });
        expect(source.id).toBe("mapzen-normals");
        expect(source.registration).toBe("area");
        expect(source.metrics.maxLOD).toBe(15);
        expect(source.metrics.tileSize).toBe(256);
        expect((await source.fetchTile({ lod: 15, x: 17008, y: 11679 })).status).toBe("absent");
        expect(urls).toEqual(["https://s3.amazonaws.com/elevation-tiles-prod/normal/15/17008/11679.png"]);
        expect(() => source.urlOf({ lod: 16, x: 34016, y: 23358 })).toThrow(RangeError);
    });
});
