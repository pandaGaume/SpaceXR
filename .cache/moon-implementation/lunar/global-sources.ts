import { readFile, stat } from "node:fs/promises";
import { download, initializeStorage, sha256, storagePath, withImportLock, writeJson } from "./storage";

/** Native signed-integer raster: pixel centres, north to south, east-positive longitudes 0..360. */
export interface IPdsLunarGrid {
    ppd: number;
    width: number;
    height: number;
    scale: number;
    sourceRadius: number;
}
export const GLOBAL_PPD = [4, 16, 64, 128] as const;
export const PDS_BASE = "https://imbrium.mit.edu/DATA/LOLA_GDR/CYLINDRICAL/IMG/";
export const COLOUR_URL = "https://svs.gsfc.nasa.gov/vis/a000000/a004700/a004720/lroc_color_poles_16k.tif";

/** One downloaded source with exact bytes and its interpretation, suitable for a build revision. */
export interface IGlobalSourceReceipt {
    url: string;
    file: string;
    bytes: number;
    sha256: string;
    labelSha256?: string;
    grid?: IPdsLunarGrid;
}

/**
 * Interpret only the documented LOLA GDR integer profile. OFFSET is a reference radius,
 * not an additive term in the stored height. Heights are DN * 0.5 metres.
 */
export function parsePdsLunarLabel(text: string, ppd: number): IPdsLunarGrid {
    const number = (name: string): number =>
        Number(new RegExp(`^\\s*${name}\\s*=\\s*([\\d.+-]+)`, "m").exec(text)?.[1]);
    const token = (name: string): string =>
        new RegExp(`^\\s*${name}\\s*=\\s*"?([^"\\r\\n]+)`, "m").exec(text)?.[1]?.trim() ?? "";
    const width = number("LINE_SAMPLES"),
        height = number("LINES");
    if (
        !GLOBAL_PPD.includes(ppd as (typeof GLOBAL_PPD)[number]) ||
        token("PRODUCT_ID") !== `LDEM_${ppd}` ||
        width !== 360 * ppd ||
        height !== 180 * ppd ||
        number("SAMPLE_BITS") !== 16 ||
        token("SAMPLE_TYPE") !== "LSB_INTEGER" ||
        token("UNIT") !== "METER" ||
        number("SCALING_FACTOR") !== 0.5 ||
        number("OFFSET") !== 1737400 ||
        number("MAP_RESOLUTION") !== ppd ||
        token("POSITIVE_LONGITUDE_DIRECTION") !== "EAST" ||
        number("WESTERNMOST_LONGITUDE") !== 0 ||
        number("EASTERNMOST_LONGITUDE") !== 360 ||
        number("MAXIMUM_LATITUDE") !== 90 ||
        number("MINIMUM_LATITUDE") !== -90 ||
        number("RECORD_BYTES") !== width * 2 ||
        number("FILE_RECORDS") !== height ||
        token("COORDINATE_SYSTEM_NAME") !== "MEAN EARTH/POLAR AXIS OF DE421" ||
        token("MAP_PROJECTION_TYPE") !== "SIMPLE CYLINDRICAL"
    )
        throw new Error(`Unsupported PDS lunar label: LDEM_${ppd}`);
    return { ppd, width, height, scale: 0.5, sourceRadius: 1737400 };
}

/** Select a native resolution by cube level, independently of the requested tile. */
export function globalSourcePpd(lod: number): number {
    if (!Number.isInteger(lod) || lod < 0 || lod > 6) throw new Error("Global generation supports levels 0 to 6");
    const degreesPerSample = 90 / (256 * 2 ** lod);
    return GLOBAL_PPD.find((ppd) => 1 / ppd <= degreesPerSample) ?? 128;
}

/** Download validated original sources. Every transfer is streamed with bounded memory. */
export async function prepareGlobalSources(
    root: string,
    log: (message: string) => void = console.log,
): Promise<IGlobalSourceReceipt[]> {
    const receipts: IGlobalSourceReceipt[] = [];
    for (const ppd of GLOBAL_PPD) {
        const key = `sources/moon/pds/LDEM_${ppd}`;
        log(`Read PDS label LDEM_${ppd}`);
        await download(`${PDS_BASE}LDEM_${ppd}.LBL`, storagePath(root, `${key}.LBL`), 64 * 1024);
        const label = await readFile(storagePath(root, `${key}.LBL`), "utf8");
        const grid = parsePdsLunarLabel(label, ppd);
        let last = 0;
        const url = `${PDS_BASE}LDEM_${ppd}.IMG`,
            file = `${key}.IMG`;
        const receipt = await download(url, storagePath(root, file), grid.width * grid.height * 2, undefined, fetch, {
            timeoutMs: 3600000,
            onProgress: (bytes) => {
                if (Date.now() - last > 10000) {
                    last = Date.now();
                    log(
                        `LDEM_${ppd}: ${(bytes / 1e6).toFixed(1)} / ${((grid.width * grid.height * 2) / 1e6).toFixed(1)} MB`,
                    );
                }
            },
        });
        if ((await stat(storagePath(root, file))).size !== grid.width * grid.height * 2)
            throw new Error("PDS file length disagrees with label");
        receipts.push({
            url,
            file,
            bytes: receipt.bytes,
            sha256: receipt.sha256,
            labelSha256: sha256(Buffer.from(label)),
            grid,
        });
        log(`Verified LDEM_${ppd}: ${receipt.sha256}`);
    }
    let last = 0;
    const file = "sources/moon/svs/lroc_color_poles_16k.tif";
    const receipt = await download(COLOUR_URL, storagePath(root, file), 256 * 1024 ** 2, undefined, fetch, {
        timeoutMs: 3600000,
        onProgress: (bytes) => {
            if (Date.now() - last > 10000) {
                last = Date.now();
                log(`LROC 16K: ${(bytes / 1e6).toFixed(1)} MB`);
            }
        },
    });
    receipts.push({ url: COLOUR_URL, file, bytes: receipt.bytes, sha256: receipt.sha256 });
    await writeJson(storagePath(root, "catalog/global-sources.json"), { schema: "lunar-global-sources/1", receipts });
    return receipts;
}

/** Import-only entry point, sharing the same exclusive root lease as generation. */
export async function importGlobalSources(root: string): Promise<IGlobalSourceReceipt[]> {
    await initializeStorage(root, 25 * 1024 ** 3);
    return withImportLock(root, () => prepareGlobalSources(root));
}
