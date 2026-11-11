import type { IImageDecoder, IRgbaImage } from "./image";

const SIGNATURE = [137, 80, 78, 71, 13, 10, 26, 10];
const MAX_PIXELS = 16_777_216;
const CRC_TABLE = Uint32Array.from({ length: 256 }, (_, value) => {
    let crc = value;
    for (let bit = 0; bit < 8; bit++) crc = crc & 1 ? 0xedb88320 ^ (crc >>> 1) : crc >>> 1;
    return crc >>> 0;
});

function crc32(bytes: Uint8Array, start: number, end: number): number {
    let crc = 0xffffffff;
    for (let i = start; i < end; i++) crc = CRC_TABLE[(crc ^ bytes[i]!) & 255]! ^ (crc >>> 8);
    return (crc ^ 0xffffffff) >>> 0;
}

function paeth(left: number, above: number, corner: number): number {
    const p = left + above - corner;
    const a = Math.abs(p - left);
    const b = Math.abs(p - above);
    const c = Math.abs(p - corner);
    return a <= b && a <= c ? left : b <= c ? above : corner;
}

async function inflate(parts: readonly Uint8Array[], length: number, signal?: AbortSignal): Promise<Uint8Array> {
    if (typeof DecompressionStream !== "function") throw new TypeError("PngDataDecoder requires DecompressionStream('deflate').");
    const stream = new ReadableStream<BufferSource>({
        start(controller) {
            for (const part of parts) controller.enqueue(part.slice());
            controller.close();
        },
    }).pipeThrough(new DecompressionStream("deflate"));
    const reader = stream.getReader();
    const output = new Uint8Array(length);
    let offset = 0;
    const abort = (): void => {
        void reader.cancel(signal?.reason).catch(() => undefined);
    };
    signal?.addEventListener("abort", abort, { once: true });
    try {
        signal?.throwIfAborted();
        let complete = false;
        while (!complete) {
            const { done, value } = await reader.read();
            signal?.throwIfAborted();
            complete = done;
            if (done) continue;
            if (offset + value.length > length) throw new RangeError("PNG decompressed data exceeds its declared dimensions.");
            output.set(value, offset);
            offset += value.length;
        }
        if (offset !== length) throw new RangeError("PNG decompressed data does not match its declared dimensions.");
        return output;
    } catch (error) {
        await reader.cancel(error).catch(() => undefined);
        signal?.throwIfAborted();
        throw new Error("Invalid PNG compressed data.", { cause: error });
    } finally {
        signal?.removeEventListener("abort", abort);
        reader.releaseLock();
    }
}

/**
 * Reads the stored samples of data PNG tiles without a canvas, colour conversion or alpha premultiplication.
 * Supports non-interlaced RGB8 and RGBA8 PNGs up to 16,777,216 pixels, filters 0 to 4 and consecutive IDAT chunks.
 * RGB files receive an opaque alpha channel. Other sample formats, animation and colour-key transparency are rejected.
 * Colour-profile chunks are intentionally ignored. PNG chunk CRCs and the zlib stream are checked.
 *
 * Format reference: https://www.w3.org/TR/png-3/
 */
export class PngDataDecoder implements IImageDecoder {
    public async decode(bytes: Uint8Array, signal?: AbortSignal): Promise<IRgbaImage> {
        signal?.throwIfAborted();
        if (bytes.length < SIGNATURE.length || SIGNATURE.some((value, i) => bytes[i] !== value)) throw new TypeError("Invalid PNG signature.");
        const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
        const parts: Uint8Array[] = [];
        let width = 0;
        let height = 0;
        let channels = 0;
        let offset = SIGNATURE.length;
        let ended = false;
        let dataEnded = false;
        while (offset < bytes.length) {
            signal?.throwIfAborted();
            if (offset + 12 > bytes.length) throw new RangeError("Truncated PNG chunk.");
            const length = view.getUint32(offset);
            const start = offset + 8;
            const end = start + length;
            if (length > 0x7fffffff || end + 4 > bytes.length) throw new RangeError("Truncated or oversized PNG chunk.");
            const type = String.fromCharCode(bytes[offset + 4]!, bytes[offset + 5]!, bytes[offset + 6]!, bytes[offset + 7]!);
            if (crc32(bytes, offset + 4, end) !== view.getUint32(end)) throw new Error(`Invalid PNG CRC for ${type}.`);
            if (offset === SIGNATURE.length && type !== "IHDR") throw new TypeError("PNG must start with IHDR.");
            if (type === "IHDR") {
                if (width !== 0 || length !== 13) throw new TypeError("Invalid PNG IHDR.");
                width = view.getUint32(start);
                height = view.getUint32(start + 4);
                const depth = bytes[start + 8];
                const color = bytes[start + 9];
                if (width === 0 || height === 0 || width > 0x7fffffff || height > 0x7fffffff || width * height > MAX_PIXELS)
                    throw new RangeError("PNG dimensions must contain 1 to 16,777,216 pixels.");
                if (depth !== 8 || (color !== 2 && color !== 6)) throw new TypeError("PngDataDecoder supports only RGB8 and RGBA8 PNGs.");
                if (bytes[start + 10] !== 0 || bytes[start + 11] !== 0) throw new TypeError("Unsupported PNG compression or filter method.");
                if (bytes[start + 12] !== 0) throw new TypeError("PngDataDecoder does not support interlaced PNGs.");
                channels = color === 6 ? 4 : 3;
            } else if (type === "IDAT") {
                if (dataEnded) throw new TypeError("PNG IDAT chunks must be consecutive.");
                parts.push(bytes.subarray(start, end));
            } else {
                if (parts.length > 0) dataEnded = true;
                if (type === "IEND") {
                    if (length !== 0 || parts.length === 0 || end + 4 !== bytes.length) throw new TypeError("Invalid PNG IEND.");
                    ended = true;
                    break;
                }
                if (type === "PLTE") {
                    if (parts.length > 0 || length === 0 || length > 768 || length % 3 !== 0) throw new TypeError("Invalid PNG PLTE.");
                } else if (type === "tRNS" || type === "acTL") {
                    throw new TypeError(`PngDataDecoder does not support PNG ${type}.`);
                } else if ((bytes[offset + 4]! & 32) === 0) throw new TypeError(`Unsupported critical PNG chunk ${type}.`);
            }
            offset = end + 4;
        }
        if (!ended) throw new TypeError("PNG is missing IEND.");
        const stride = width * channels;
        const filtered = await inflate(parts, (stride + 1) * height, signal);
        const samples = new Uint8Array(stride * height);
        for (let y = 0; y < height; y++) {
            signal?.throwIfAborted();
            const source = y * (stride + 1);
            const filter = filtered[source]!;
            if (filter > 4) throw new TypeError(`Unsupported PNG scanline filter ${filter}.`);
            for (let x = 0; x < stride; x++) {
                const index = y * stride + x;
                const left = x < channels ? 0 : samples[index - channels]!;
                const above = y === 0 ? 0 : samples[index - stride]!;
                const corner = y === 0 || x < channels ? 0 : samples[index - stride - channels]!;
                const predictor = filter === 0 ? 0 : filter === 1 ? left : filter === 2 ? above : filter === 3 ? Math.floor((left + above) / 2) : paeth(left, above, corner);
                samples[index] = (filtered[source + x + 1]! + predictor) & 255;
            }
        }
        if (channels === 4) return { width, height, channels: 4, data: samples };
        const rgba = new Uint8Array(width * height * 4);
        for (let source = 0, target = 0; source < samples.length; source += 3, target += 4) {
            rgba[target] = samples[source]!;
            rgba[target + 1] = samples[source + 1]!;
            rgba[target + 2] = samples[source + 2]!;
            rgba[target + 3] = 255;
        }
        return { width, height, channels: 4, data: rgba };
    }
}
