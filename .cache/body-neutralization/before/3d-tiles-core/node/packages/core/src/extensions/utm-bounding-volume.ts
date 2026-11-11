import { SPACEXR_BOUNDING_VOLUME_UTM } from "../model";
import type { IBoundingVolume, IContent, IJsonObject, ITileset, IUtmBoundingVolume, Refinement, UtmHemisphere } from "../model";

/** UTM projection resolved from an EPSG code or from an explicit zone and hemisphere. */
export interface IUtmProjection {
    zone: number;
    hemisphere: UtmHemisphere;
    /** Horizontal datum name when the EPSG code is known, for example `NAD83(CSRS)`. */
    datum?: string;
    epsg?: number;
}

/** NAD83(CSRS) / UTM codes are not contiguous. Keys are EPSG codes, values are northern zones. */
const NAD83_CSRS_ZONES: ReadonlyMap<number, number> = new Map([
    [3154, 7],
    [3155, 8],
    [3156, 9],
    [3157, 10],
    [2955, 11],
    [2956, 12],
    [2957, 13],
    [3158, 14],
    [3159, 15],
    [3160, 16],
    [2958, 17],
    [2959, 18],
    [2960, 19],
    [2961, 20],
    [2962, 21],
    [3761, 22],
]);

/**
 * Resolves a projected EPSG code to its UTM zone and hemisphere.
 *
 * Recognizes WGS 84 (326xx and 327xx), NAD83 (269xx), NAD83(CSRS) and ETRS89 (258xx) UTM codes.
 * Returns `undefined` for any other code, in which case the zone and hemisphere must be stated explicitly.
 */
export function utmProjectionFromEpsg(epsg: number): IUtmProjection | undefined {
    if (!Number.isInteger(epsg)) return undefined;
    if (epsg >= 32601 && epsg <= 32660) return { zone: epsg - 32600, hemisphere: "N", datum: "WGS 84", epsg };
    if (epsg >= 32701 && epsg <= 32760) return { zone: epsg - 32700, hemisphere: "S", datum: "WGS 84", epsg };
    if (epsg >= 26901 && epsg <= 26923) return { zone: epsg - 26900, hemisphere: "N", datum: "NAD83", epsg };
    if (epsg >= 25828 && epsg <= 25838) return { zone: epsg - 25800, hemisphere: "N", datum: "ETRS89", epsg };
    const csrsZone = NAD83_CSRS_ZONES.get(epsg);
    return csrsZone === undefined ? undefined : { zone: csrsZone, hemisphere: "N", datum: "NAD83(CSRS)", epsg };
}

/** Resolves the UTM projection of an extent, preferring a recognized EPSG code over the explicit zone. */
export function resolveUtmProjection(extent: IUtmBoundingVolume): IUtmProjection | undefined {
    const known = extent.epsg === undefined ? undefined : utmProjectionFromEpsg(extent.epsg);
    if (known) return known;
    if (extent.zone === undefined || extent.hemisphere === undefined) return undefined;
    return extent.epsg === undefined ? { zone: extent.zone, hemisphere: extent.hemisphere } : { zone: extent.zone, hemisphere: extent.hemisphere, epsg: extent.epsg };
}

/** Returns the UTM extent carried by a bounding volume, if any. */
export function getUtmBoundingVolume(volume: IBoundingVolume | undefined): IUtmBoundingVolume | undefined {
    return volume?.extensions?.[SPACEXR_BOUNDING_VOLUME_UTM] as IUtmBoundingVolume | undefined;
}

/** Creates a bounding volume whose only description is a UTM extent. */
export function createUtmBoundingVolume(extent: IUtmBoundingVolume): IBoundingVolume {
    return { extensions: { [SPACEXR_BOUNDING_VOLUME_UTM]: extent as unknown as IJsonObject } };
}

export interface IUtmTilesetOptions {
    extent: IUtmBoundingVolume;
    /** Geometric error of the tileset and of its single tile. Defaults to 0. */
    geometricError?: number;
    refine?: Refinement;
    content?: IContent;
    tilesetVersion?: string;
}

/**
 * Creates a 3D Tiles 1.1 tileset made of a single root tile located by a UTM extent.
 *
 * The extension is declared in `extensionsUsed` and `extensionsRequired` because the tile has no standard bounding volume.
 */
export function createUtmTileset(options: IUtmTilesetOptions): ITileset {
    const geometricError = options.geometricError ?? 0;
    const tileset: ITileset = {
        asset: options.tilesetVersion === undefined ? { version: "1.1" } : { version: "1.1", tilesetVersion: options.tilesetVersion },
        geometricError,
        root: {
            boundingVolume: createUtmBoundingVolume(options.extent),
            geometricError,
            refine: options.refine ?? "REPLACE",
        },
        extensionsUsed: [SPACEXR_BOUNDING_VOLUME_UTM],
        extensionsRequired: [SPACEXR_BOUNDING_VOLUME_UTM],
    };
    if (options.content !== undefined) tileset.root.content = options.content;
    return tileset;
}
