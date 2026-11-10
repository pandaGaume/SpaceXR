import { afterEach, describe, expect, it, vi } from "vitest";

import { BrowserImageDecoder } from "../src";

describe("BrowserImageDecoder", () => {
    afterEach(() => vi.unstubAllGlobals());

    it("disables colour conversion and alpha premultiplication", async () => {
        const createImageBitmap = vi.fn(() => Promise.resolve({ width: 1, height: 1, close: vi.fn() }));
        const context = { drawImage: vi.fn(), getImageData: () => ({ width: 1, height: 1, data: new Uint8ClampedArray([128, 0, 0, 255]) }) };
        vi.stubGlobal("createImageBitmap", createImageBitmap);
        vi.stubGlobal(
            "OffscreenCanvas",
            class {
                public getContext(): typeof context {
                    return context;
                }
            }
        );

        const decoded = await new BrowserImageDecoder().decode(new Uint8Array([1, 2]));
        expect(decoded).toEqual({ width: 1, height: 1, channels: 4, data: new Uint8ClampedArray([128, 0, 0, 255]) });
        expect(createImageBitmap).toHaveBeenCalledWith(expect.any(Blob), { colorSpaceConversion: "none", premultiplyAlpha: "none" });
    });

    it("explains when the browser APIs are unavailable", async () => {
        vi.stubGlobal("createImageBitmap", undefined);
        await expect(new BrowserImageDecoder().decode(new Uint8Array())).rejects.toThrow(TypeError);
    });
});
