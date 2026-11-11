import type { IRasterGrid } from "./raster-grid";

/** Decoded image with 8-bit RGBA pixels, row-major from the top-left corner: a raster of four channels. */
export interface IRgbaImage extends IRasterGrid<Uint8Array | Uint8ClampedArray> {
    /** R, G, B, A, not premultiplied. */
    channels: 4;
}

/**
 * Port decoding encoded image bytes (PNG, WebP, JPEG) into RGBA pixels.
 *
 * Implementations must return the stored pixel values unchanged: no colour space conversion and no alpha
 * premultiplication, otherwise values encoded in the pixels, such as elevations, are corrupted.
 */
export interface IImageDecoder {
    decode(bytes: Uint8Array, signal?: AbortSignal): Promise<IRgbaImage>;
}

/**
 * Image decoder for browsers and web workers, based on `createImageBitmap` and `OffscreenCanvas`.
 *
 * Node.js has neither API; supply another {@link IImageDecoder} there.
 */
export class BrowserImageDecoder implements IImageDecoder {
    public async decode(bytes: Uint8Array, signal?: AbortSignal): Promise<IRgbaImage> {
        if (typeof createImageBitmap !== "function" || typeof OffscreenCanvas !== "function") {
            throw new TypeError("BrowserImageDecoder requires createImageBitmap and OffscreenCanvas.");
        }
        signal?.throwIfAborted();
        // Copy into a plain ArrayBuffer: Blob rejects views over SharedArrayBuffer.
        const bitmap = await createImageBitmap(new Blob([bytes.slice()]), { colorSpaceConversion: "none", premultiplyAlpha: "none" });
        try {
            signal?.throwIfAborted();
            const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
            const context = canvas.getContext("2d", { willReadFrequently: true });
            if (!context) throw new TypeError("OffscreenCanvas 2D context is not available.");
            context.drawImage(bitmap, 0, 0);
            const image = context.getImageData(0, 0, bitmap.width, bitmap.height);
            return { width: image.width, height: image.height, channels: 4, data: image.data };
        } finally {
            bitmap.close();
        }
    }
}
