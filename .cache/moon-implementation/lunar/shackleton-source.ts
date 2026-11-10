import { stat } from "node:fs/promises";
import { fromFile } from "geotiff";
import { download, storagePath, writeJson } from "./storage";

export const SHACKLETON_DEM_URL = "https://pgda.gsfc.nasa.gov/data/LOLA_5mpp/87S/ldem_87s_5mpp.tif";
export const SHACKLETON_LDEC_URL = "https://pgda.gsfc.nasa.gov/data/LOLA_5mpp/87S/ldec_87s_5mpp.tif";
export const SHACKLETON_DEM_KEY = "sources/moon/pgda/ldem_87s_5mpp.tif";
export const SHACKLETON_LDEC_KEY = "sources/moon/pgda/ldec_87s_5mpp.tif";

export interface IShackletonRasterMetadata {
    key: string;
    bytes: number;
    width: number;
    height: number;
    origin: number[];
    resolution: number[];
    bounds: number[];
    samplesPerPixel: number;
    bitsPerSample: number;
    sampleFormat: number;
    noData: number | null;
    geoKeys: Record<string, unknown> | null;
}

export async function inspectShackletonRaster(root: string, key: string): Promise<IShackletonRasterMetadata> {
    const file = storagePath(root, key),
        tiff = await fromFile(file);
    try {
        const image = await tiff.getImage();
        return {
            key,
            bytes: (await stat(file)).size,
            width: image.getWidth(),
            height: image.getHeight(),
            origin: image.getOrigin(),
            resolution: image.getResolution(),
            bounds: image.getBoundingBox(),
            samplesPerPixel: image.getSamplesPerPixel(),
            bitsPerSample: image.getBitsPerSample(),
            sampleFormat: image.getSampleFormat(),
            noData: image.getGDALNoData(),
            geoKeys: image.getGeoKeys() as Record<string, unknown> | null,
        };
    } finally {
        await tiff.close();
    }
}

export async function importShackletonSources(root: string, log: (message: string) => void = console.log) {
    const sources = [
        { url: SHACKLETON_DEM_URL, key: SHACKLETON_DEM_KEY, maximum: 4 * 1024 ** 3, label: "PGDA81 LOLA 87S 5m DEM" },
        { url: SHACKLETON_LDEC_URL, key: SHACKLETON_LDEC_KEY, maximum: 256 * 1024 ** 2, label: "PGDA81 LOLA return counts" },
    ];
    const receipts = [];
    for (const source of sources) {
        let last = 0;
        log(`Download ${source.label}`);
        const receipt = await download(source.url, storagePath(root, source.key), source.maximum, undefined, fetch, {
            timeoutMs: 6 * 60 * 60 * 1000,
            onProgress: (bytes) => {
                if (Date.now() - last > 10000) {
                    last = Date.now();
                    log(`${source.label}: ${(bytes / 1e9).toFixed(2)} GB`);
                }
            },
        });
        const metadata = await inspectShackletonRaster(root, source.key);
        if (metadata.width < 1000 || metadata.height < 1000 || metadata.samplesPerPixel !== 1)
            throw new Error(`Unexpected PGDA81 raster structure: ${source.key}`);
        if (source.key === SHACKLETON_DEM_KEY && (metadata.bitsPerSample !== 32 || metadata.sampleFormat !== 3))
            throw new Error("PGDA81 elevation source is not a single-band Float32 raster.");
        receipts.push({ ...receipt, url: source.url, file: source.key, metadata });
        log(`${source.label}: ${metadata.width} x ${metadata.height}, ${receipt.sha256}`);
    }
    const manifest = { schema: "lunar-shackleton-source/1", importedAt: new Date().toISOString(), receipts };
    await writeJson(storagePath(root, "catalog/shackleton-sources.json"), manifest);
    return manifest;
}
