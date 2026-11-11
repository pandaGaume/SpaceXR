import { describe, expect, it } from "vitest";

import {
    SPACEXR_BOUNDING_VOLUME_UTM,
    TilesetJsonCodec,
    createUtmTileset,
    getUtmBoundingVolume,
    resolveUtmProjection,
    utmProjectionFromEpsg,
    validateUtmBoundingVolume,
    type IUtmBoundingVolume,
} from "../src";

const drillHoleExtent: IUtmBoundingVolume = {
    epsg: 26918,
    minEasting: 438510.189,
    minNorthing: 5830109.72,
    maxEasting: 438900.189,
    maxNorthing: 5830499.72,
    vertical: { reference: "GROUND", direction: "DOWN", minimum: 0, maximum: 195, groundElevation: 254.085, epsg: 6647 },
};

describe("SPACEXR_bounding_volume_utm", () => {
    it("serializes a single tile tileset and reads its extent back", () => {
        const codec = new TilesetJsonCodec();
        const text = codec.encode(createUtmTileset({ extent: drillHoleExtent, tilesetVersion: "CH12-001" }), { pretty: 2 });
        const tileset = codec.decode(text);

        expect(tileset.extensionsUsed).toEqual([SPACEXR_BOUNDING_VOLUME_UTM]);
        expect(tileset.extensionsRequired).toEqual([SPACEXR_BOUNDING_VOLUME_UTM]);
        expect(tileset.root.refine).toBe("REPLACE");
        expect(tileset.root.boundingVolume.box).toBeUndefined();
        expect(getUtmBoundingVolume(tileset.root.boundingVolume)).toEqual(drillHoleExtent);
    });

    it("resolves recognized EPSG codes to a zone and hemisphere", () => {
        expect(utmProjectionFromEpsg(26918)).toEqual({ zone: 18, hemisphere: "N", datum: "NAD83", epsg: 26918 });
        expect(utmProjectionFromEpsg(2959)).toEqual({ zone: 18, hemisphere: "N", datum: "NAD83(CSRS)", epsg: 2959 });
        expect(utmProjectionFromEpsg(32631)).toEqual({ zone: 31, hemisphere: "N", datum: "WGS 84", epsg: 32631 });
        expect(utmProjectionFromEpsg(32718)).toEqual({ zone: 18, hemisphere: "S", datum: "WGS 84", epsg: 32718 });
        expect(utmProjectionFromEpsg(25832)).toEqual({ zone: 32, hemisphere: "N", datum: "ETRS89", epsg: 25832 });
        expect(utmProjectionFromEpsg(26718)).toBeUndefined();
    });

    it("falls back to the explicit zone for unrecognized EPSG codes", () => {
        expect(resolveUtmProjection({ ...drillHoleExtent, epsg: 26718, zone: 18, hemisphere: "N" })).toEqual({ zone: 18, hemisphere: "N", epsg: 26718 });
        expect(resolveUtmProjection({ ...drillHoleExtent, epsg: 26718 })).toBeUndefined();
    });

    it("validates a standalone extension object", () => {
        expect(validateUtmBoundingVolume(drillHoleExtent).valid).toBe(true);
        const result = validateUtmBoundingVolume({ ...drillHoleExtent, zone: 19, hemisphere: "N" });
        expect(result.valid).toBe(false);
        expect(result.diagnostics.map((diagnostic) => diagnostic.code)).toEqual(["UTM_EPSG_ZONE_MISMATCH"]);
    });
});
