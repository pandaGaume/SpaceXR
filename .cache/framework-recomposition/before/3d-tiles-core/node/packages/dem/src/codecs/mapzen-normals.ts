import { PngDataDecoder, assertRasterSize, type IImageDecoder, type IRasterGrid, type IRgbaImage } from "@spacexr/raster";

/** Unit tangent-space surface normals, XYZ per sample. An invalid zero encoded vector is NaN in every channel. */
export interface INormalGrid extends IRasterGrid<Float32Array> {
    channels: 3;
}

/** Stored Mapzen normal RGB values. Alpha encodes elevation and is discarded, including when it is zero. */
export function decodeMapzenNormalPixels(image: IRgbaImage): IRasterGrid<Uint8Array> & { channels: 3 } {
    assertRasterSize(image.width, image.height, 4, image.data.length);
    const data = new Uint8Array(image.width * image.height * 3);
    for (let source = 0, target = 0; source < image.data.length; source += 4, target += 3) {
        data[target] = image.data[source]!;
        data[target + 1] = image.data[source + 1]!;
        data[target + 2] = image.data[source + 2]!;
    }
    return { width: image.width, height: image.height, channels: 3, data };
}

/**
 * Decodes Mapzen normal PNG samples as normalize(RGB / 128 - 1). Alpha is quantized elevation, never opacity.
 * The vectors remain in the provider's tangent frame; the renderer transforms them onto its reference surface.
 */
export function decodeMapzenNormals(image: IRgbaImage): INormalGrid {
    assertRasterSize(image.width, image.height, 4, image.data.length);
    const data = new Float32Array(image.width * image.height * 3);
    for (let source = 0, target = 0; source < image.data.length; source += 4, target += 3) {
        const x = image.data[source]! / 128 - 1;
        const y = image.data[source + 1]! / 128 - 1;
        const z = image.data[source + 2]! / 128 - 1;
        const length = Math.hypot(x, y, z);
        data[target] = length === 0 ? Number.NaN : x / length;
        data[target + 1] = length === 0 ? Number.NaN : y / length;
        data[target + 2] = length === 0 ? Number.NaN : z / length;
    }
    return { width: image.width, height: image.height, channels: 3, data };
}

/** Decodes encoded Mapzen normal data without canvas alpha or colour transformations. */
export async function decodeMapzenNormalTile(bytes: Uint8Array, imageDecoder: IImageDecoder = new PngDataDecoder(), signal?: AbortSignal): Promise<INormalGrid> {
    const image = await imageDecoder.decode(bytes, signal);
    signal?.throwIfAborted();
    return decodeMapzenNormals(image);
}
