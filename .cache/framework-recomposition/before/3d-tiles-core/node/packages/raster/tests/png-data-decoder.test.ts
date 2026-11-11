import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";

import { PngDataDecoder } from "../src";

const fixture = (name: string): Uint8Array => new Uint8Array(readFileSync(new URL(`./fixtures/${name}.png`, import.meta.url)));

describe("PngDataDecoder", () => {
    afterEach(() => vi.unstubAllGlobals());

    it.each(["rgba8", "rgb8"])("reverses all five PNG filters and split IDATs without modifying %s samples", async (format) => {
        const image = await new PngDataDecoder().decode(fixture(`data-${format}-filters`));
        const expected: number[] = [];
        for (let y = 0; y < 5; y++) {
            for (let x = 0; x < 5; x++) {
                expected.push((x * 47 + y * 19 + 3) % 256, (x * 13 + y * 61 + 129) % 256, (x * 97 + y * 7 + 251) % 256, format === "rgba8" ? 20 + ((y * 5 + x) % 19) : 255);
            }
        }
        expect(image).toEqual({ width: 5, height: 5, channels: 4, data: new Uint8Array(expected) });
    });

    it("preserves RGB even at zero alpha and never calls image or canvas APIs", async () => {
        const bitmap = vi.fn(() => {
            throw new Error("Canvas path must not run");
        });
        vi.stubGlobal("createImageBitmap", bitmap);
        vi.stubGlobal("OffscreenCanvas", bitmap);
        expect((await new PngDataDecoder().decode(fixture("data-rgba8-zero-alpha"))).data).toEqual(new Uint8Array([200, 10, 123, 0]));
        expect(bitmap).not.toHaveBeenCalled();
    });

    it.each([
        ["data-rgba16", "RGB8 and RGBA8"],
        ["data-grayscale8", "RGB8 and RGBA8"],
        ["data-rgba8-interlaced", "interlaced"],
        ["data-invalid-filter", "scanline filter"],
        ["data-nonconsecutive-idat", "consecutive"],
    ])("rejects unsupported or invalid declared formats: %s", async (name, error) => {
        await expect(new PngDataDecoder().decode(fixture(name))).rejects.toThrow(error);
    });

    it("rejects corrupt CRCs, missing end chunks, truncated chunks and non-PNG data", async () => {
        const bytes = fixture("data-rgba8-filters");
        const corrupt = bytes.slice();
        corrupt[corrupt.length - 1] = corrupt[corrupt.length - 1]! ^ 1;
        await expect(new PngDataDecoder().decode(corrupt)).rejects.toThrow("CRC");
        await expect(new PngDataDecoder().decode(bytes.subarray(0, bytes.length - 12))).rejects.toThrow("missing IEND");
        await expect(new PngDataDecoder().decode(bytes.subarray(0, bytes.length - 1))).rejects.toThrow("Truncated");
        await expect(new PngDataDecoder().decode(new Uint8Array([1, 2, 3]))).rejects.toThrow("signature");
    });

    it("honours cancellation before and during decompression", async () => {
        for (const early of [true, false]) {
            const controller = new AbortController();
            const reason = new Error("cancelled PNG");
            if (early) controller.abort(reason);
            const operation = new PngDataDecoder().decode(fixture("data-rgba8-filters"), controller.signal);
            if (!early) controller.abort(reason);
            await expect(operation).rejects.toBe(reason);
        }
    });

    it("explains a missing standard decompressor", async () => {
        vi.stubGlobal("DecompressionStream", undefined);
        await expect(new PngDataDecoder().decode(fixture("data-rgba8-filters"))).rejects.toThrow("DecompressionStream");
    });
});
