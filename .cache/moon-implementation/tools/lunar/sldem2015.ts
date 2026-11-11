import { readFile } from "node:fs/promises";
import {
    download,
    initializeStorage,
    storagePath,
    withImportLock,
    writeJson,
} from "./storage";

const ROOT_URL = "https://imbrium.mit.edu/DATA/SLDEM2015/TILES/JP2";
const FLOAT_IMAGE_URL = "https://imbrium.mit.edu/DATA/SLDEM2015/TILES/FLOAT_IMG";
const AUX_URL = "https://imbrium.mit.edu/DATA/SLDEM2015/TILES/JP2";
const CELLS_PER_DEGREE = 512;
const SOURCE_RADIUS = 1737400;
const SECTORS = Array.from({ length: 8 }, (_, index) => index * 45);

interface IRegion {
    id: string;
    north: number;
    south: number;
    longitudeStart: number;
    longitudeEnd: number;
    label: string;
    floatLabel: string;
    floatImage: string;
    aux: string;
}

export interface ISLDEMRegion extends IRegion {
    width: number;
    height: number;
    ppd: number;
    sampleBits: number;
    sampleType: string;
    centerLatitude: number;
    centerLongitude: number;
    lineProjectionOffset: number;
    sampleProjectionOffset: number;
    sourceRadius: number;
    sourceUnit: string;
    scalingFactor: number;
    offset: number;
    byteOrder: "LE" | "BE";
    missingValue?: number;
}

export interface ISLDEMReceipt {
    id: string;
    label: string;
    floatLabel: string;
    floatImage: string;
    auxiliary: string;
    labelBytes: number;
    floatLabelBytes: number;
    auxiliaryBytes: number;
    floatImageBytes: number;
    labelSha256: string;
    floatLabelSha256: string;
    auxiliarySha256: string;
    region: ISLDEMRegion;
}

function regions(): IRegion[] {
    const latitudes = [
        { id: "00N_30N", north: 30, south: 0 },
        { id: "30N_60N", north: 60, south: 30 },
        { id: "30S_00S", north: 0, south: -30 },
        { id: "60S_30S", north: -30, south: -60 },
    ];
    return latitudes.flatMap(({ id, north, south }) =>
        SECTORS.map((longitudeStart) => {
            const longitudeEnd = longitudeStart + 45;
            const key = `SLDEM2015_512_${id}_${String(longitudeStart).padStart(3, "0")}_${String(longitudeEnd).padStart(3, "0")}`;
            return {
                id: key,
                north,
                south,
                longitudeStart,
                longitudeEnd,
                label: `${key}_JP2.LBL`,
                floatLabel: `${key}_FLOAT.LBL`,
                floatImage: `${key}_FLOAT.IMG`,
                aux: `${key}_AUX.XML`,
            };
        }),
    );
}

function parseLabel(mapText: string, floatText: string, source: IRegion): ISLDEMRegion {
    const number = (text: string, name: string): number => {
        const match = new RegExp(`^\\s*${name}\\s*=\\s*([+-]?[\\d.]+(?:[Ee][+-]?\\d+)?)`, "m").exec(text);
        return match ? Number(match[1]) : Number.NaN;
    };
    const token = (text: string, name: string): string =>
        new RegExp(`^\\s*${name}\\s*=\\s*"?([^"\\r\\n]+)`, "m").exec(text)?.[1]?.trim() ?? "";
    const width = number(floatText, "LINE_SAMPLES");
    const height = number(floatText, "LINES");
    const ppd = number(mapText, "MAP_RESOLUTION");
    const sampleBits = number(floatText, "SAMPLE_BITS");
    const sampleType = token(floatText, "SAMPLE_TYPE");
    const projection = token(mapText, "MAP_PROJECTION_TYPE");
    const labelRadius = number(mapText, "A_AXIS_RADIUS");
    const radiusUnit = new RegExp(`^\\s*A_AXIS_RADIUS\\s*=\\s*[+-]?[\\d.]+\\s*<([^>]+)>`, "m").exec(mapText)?.[1]?.trim();
    const sourceRadius = radiusUnit?.toUpperCase().startsWith("KM") ? labelRadius * 1000 : labelRadius;
    const north = number(mapText, "MAXIMUM_LATITUDE");
    const south = number(mapText, "MINIMUM_LATITUDE");
    const west = number(mapText, "WESTERNMOST_LONGITUDE");
    const east = number(mapText, "EASTERNMOST_LONGITUDE");
    const rawOffset = number(floatText, "OFFSET");
    const sourceUnit = token(floatText, "UNIT").toUpperCase();
    const unitToMeters = sourceUnit === "KILOMETER" ? 1000 : sourceUnit === "METER" ? 1 : Number.NaN;
    const offsetIsReferenceRadius =
        Math.abs(rawOffset - labelRadius) < 1e-6 ||
        Math.abs(rawOffset * unitToMeters - SOURCE_RADIUS) < 1e-3;
    const offset = Number.isFinite(rawOffset) && !offsetIsReferenceRadius ? rawOffset * unitToMeters : 0;
    const missingValue = number(floatText, "MISSING_CONSTANT");
    const coreNull = number(floatText, "CORE_NULL");
    const region: ISLDEMRegion = {
        ...source,
        width,
        height,
        ppd,
        sampleBits,
        sampleType,
        centerLatitude: number(mapText, "CENTER_LATITUDE"),
        centerLongitude: number(mapText, "CENTER_LONGITUDE"),
        lineProjectionOffset: number(mapText, "LINE_PROJECTION_OFFSET"),
        sampleProjectionOffset: number(mapText, "SAMPLE_PROJECTION_OFFSET"),
        sourceRadius,
        sourceUnit,
        scalingFactor: (number(floatText, "SCALING_FACTOR") || 1) * unitToMeters,
        offset,
        byteOrder: /PC_REAL|LSB/i.test(sampleType) ? "LE" : "BE",
        ...(Number.isFinite(missingValue) ? { missingValue } : Number.isFinite(coreNull) ? { missingValue: coreNull } : {}),
    };
    if (
        token(mapText, "PRODUCT_ID") !== source.id ||
        !Number.isInteger(width) ||
        !Number.isInteger(height) ||
        width !== 45 * CELLS_PER_DEGREE ||
        height !== 30 * CELLS_PER_DEGREE ||
        ppd !== CELLS_PER_DEGREE ||
        projection !== "SIMPLE CYLINDRICAL" ||
        north !== source.north ||
        south !== source.south ||
        west !== source.longitudeStart ||
        east !== source.longitudeEnd ||
        !Number.isFinite(sourceRadius) ||
        Math.abs(sourceRadius - SOURCE_RADIUS) > 1e-6 ||
        !Number.isFinite(unitToMeters) ||
        token(mapText, "COORDINATE_SYSTEM_NAME") !== "MEAN EARTH/POLAR AXIS OF DE421" ||
        !Number.isFinite(region.scalingFactor) ||
        !Number.isFinite(region.offset)
    )
        throw new Error(`Unsupported SLDEM2015 map label for ${source.id}`);
    if (sampleBits !== 32 || !/REAL/i.test(sampleType))
        throw new Error(`Unsupported SLDEM2015 sample encoding for ${source.id}: ${sampleBits} ${sampleType}`);
    return region;
}

/** Import detached labels for all native 512 ppd Float IMG regions. Height grids are fetched on demand. */
export async function importSLDEM2015(
    root: string,
    log: (message: string) => void = console.log,
): Promise<ISLDEMReceipt[]> {
    await initializeStorage(root, 12 * 1024 ** 3);
    return withImportLock(root, async () => {
        const receipts: ISLDEMReceipt[] = [];
        for (const region of regions()) {
            const labelKey = `sources/moon/sldem2015/${region.label}`;
            const floatLabelKey = `sources/moon/sldem2015/${region.floatLabel}`;
            const auxiliaryKey = `sources/moon/sldem2015/${region.aux}`;
            const labelReceipt = await download(`${ROOT_URL}/${region.label}`, storagePath(root, labelKey), 64 * 1024);
            const floatLabelReceipt = await download(`${FLOAT_IMAGE_URL}/${region.floatLabel}`, storagePath(root, floatLabelKey), 64 * 1024);
            const auxiliaryReceipt = await download(`${AUX_URL}/${region.aux}`, storagePath(root, auxiliaryKey), 64 * 1024);
            const [mapText, floatText] = await Promise.all([
                readFile(storagePath(root, labelKey), "utf8"),
                readFile(storagePath(root, floatLabelKey), "utf8"),
            ]);
            const metadata = parseLabel(mapText, floatText, region);
            const expectedBytes = metadata.width * metadata.height * (metadata.sampleBits / 8);
            receipts.push({
                id: region.id,
                label: labelKey,
                floatLabel: floatLabelKey,
                floatImage: `sources/moon/sldem2015/${region.floatImage}`,
                auxiliary: auxiliaryKey,
                labelBytes: labelReceipt.bytes,
                floatLabelBytes: floatLabelReceipt.bytes,
                auxiliaryBytes: auxiliaryReceipt.bytes,
                floatImageBytes: expectedBytes,
                labelSha256: labelReceipt.sha256,
                floatLabelSha256: floatLabelReceipt.sha256,
                auxiliarySha256: auxiliaryReceipt.sha256,
                region: metadata,
            });
            log(`Indexed SLDEM2015 ${region.id}: ${metadata.width} x ${metadata.height}, ${metadata.sampleType}`);
        }
        await writeJson(storagePath(root, "catalog/sldem2015-sources.json"), {
            schema: "lunar-sldem2015-source/1",
            dataset: "SLDEM2015",
            frame: "MOON_ME_DE421",
            referenceRadius: SOURCE_RADIUS,
            coverage: { south: -60, north: 60, ppd: CELLS_PER_DEGREE },
            sourceEncoding: "native-pds-float-img",
            regions: receipts.length,
            lazyFloatImageBytes: receipts.reduce((sum, receipt) => sum + receipt.floatImageBytes, 0),
            receipts,
        });
        return receipts;
    });
}

/** Download one lossless native Float IMG region and return its exact source bytes. */
export async function loadSLDEMRegion(
    root: string,
    receipt: ISLDEMReceipt,
    log: (message: string) => void = console.log,
): Promise<{ values: Buffer; sha256: string }> {
    const target = storagePath(root, receipt.floatImage);
    const expectedBytes = receipt.floatImageBytes;
    let lastProgress = 0;
    const source = await download(
        `${FLOAT_IMAGE_URL}/${receipt.region.floatImage}`,
        target,
        expectedBytes,
        undefined,
        fetch,
        {
            timeoutMs: 3600000,
            onProgress: (bytes) => {
                if (Date.now() - lastProgress > 10000) {
                    lastProgress = Date.now();
                    log(`SLDEM2015 ${receipt.id}: ${(bytes / 1e9).toFixed(2)} / ${(expectedBytes / 1e9).toFixed(2)} GB`);
                }
            },
        },
    );
    if (source.bytes !== expectedBytes) throw new Error(`Unexpected Float IMG length for ${receipt.id}`);
    return { values: await readFile(target), sha256: source.sha256 };
}

/** Return source regions in deterministic north-to-south, west-to-east order. */
export function findSLDEMRegion(receipts: readonly ISLDEMReceipt[], longitude: number, latitude: number): ISLDEMReceipt {
    if (latitude < -60 || latitude > 60) throw new RangeError("SLDEM2015 coverage is limited to 60 degrees north and south.");
    const lon = ((longitude % 360) + 360) % 360;
    const receipt = receipts.find(
        ({ region }) =>
            latitude >= region.south &&
            latitude <= region.north &&
            lon >= region.longitudeStart &&
            lon <= region.longitudeEnd,
    );
    if (!receipt) throw new Error(`No SLDEM2015 region for ${lon}, ${latitude}`);
    return receipt;
}
