import { utmProjectionFromEpsg } from "../extensions";
import type { IUtmBoundingVolume } from "../model";
import type { IDiagnostic, IValidationResult } from "./diagnostic";
import { addError, addWarning, isFiniteNumber, isPositiveInteger, isRecord, validateRootProperties, type RecordValue } from "./shared";

const UTM_HEMISPHERES: ReadonlySet<unknown> = new Set(["N", "S"]);
const VERTICAL_REFERENCES: ReadonlySet<unknown> = new Set(["ELLIPSOID", "GEOID", "GROUND", "LOCAL"]);
const VERTICAL_DIRECTIONS: ReadonlySet<unknown> = new Set(["UP", "DOWN"]);
const UTM_COORDINATES = ["minEasting", "minNorthing", "maxEasting", "maxNorthing"] as const;

/** UTM eastings lie strictly between 0 and 1,000,000 m around the 500,000 m false easting. */
const MAX_EASTING = 1_000_000;
/** UTM northings lie between 0 and 10,000,000 m in both hemispheres. */
const MAX_NORTHING = 10_000_000;

function validateUtmProjection(value: RecordValue, path: string, diagnostics: IDiagnostic[]): void {
    const hasEpsg = value.epsg !== undefined;
    const hasZone = value.zone !== undefined;
    const hasHemisphere = value.hemisphere !== undefined;

    if (!hasEpsg && !hasZone && !hasHemisphere) {
        addError(diagnostics, "UTM_REFERENCE_MISSING", path, "Expected an EPSG code, a zone and hemisphere, or both.");
        return;
    }

    const epsgValid = hasEpsg && isPositiveInteger(value.epsg);
    if (hasEpsg && !epsgValid) addError(diagnostics, "INVALID_UTM_EPSG", `${path}/epsg`, "Expected a positive integer EPSG code.");

    const zoneValid = hasZone && isPositiveInteger(value.zone) && value.zone <= 60;
    if (hasZone && !zoneValid) addError(diagnostics, "INVALID_UTM_ZONE", `${path}/zone`, "Expected an integer UTM zone from 1 to 60.");

    const hemisphereValid = hasHemisphere && UTM_HEMISPHERES.has(value.hemisphere);
    if (hasHemisphere && !hemisphereValid) addError(diagnostics, "INVALID_UTM_HEMISPHERE", `${path}/hemisphere`, "Expected N or S.");

    if (hasZone !== hasHemisphere) addError(diagnostics, "INCOMPLETE_UTM_ZONE", path, "zone and hemisphere must be stated together.");

    if (!hasEpsg) {
        addWarning(diagnostics, "UTM_EPSG_MISSING", path, "Without an EPSG code the horizontal datum is unknown.");
        return;
    }
    if (!epsgValid) return;

    const known = utmProjectionFromEpsg(value.epsg as number);
    if (!known) {
        if (!hasZone && !hasHemisphere) {
            addError(diagnostics, "UTM_ZONE_REQUIRED", path, `EPSG:${String(value.epsg)} is not a recognized UTM code; zone and hemisphere are required.`);
        }
        return;
    }
    if ((zoneValid && value.zone !== known.zone) || (hemisphereValid && value.hemisphere !== known.hemisphere)) {
        addError(diagnostics, "UTM_EPSG_ZONE_MISMATCH", path, `EPSG:${known.epsg} is UTM zone ${known.zone}${known.hemisphere}.`);
    }
}

function validateUtmExtent(value: RecordValue, path: string, diagnostics: IDiagnostic[]): void {
    let finite = true;
    for (const name of UTM_COORDINATES) {
        if (!isFiniteNumber(value[name])) {
            addError(diagnostics, "INVALID_UTM_COORDINATE", `${path}/${name}`, "Expected a finite number of metres.");
            finite = false;
        }
    }
    if (!finite) return;

    const minEasting = value.minEasting as number;
    const minNorthing = value.minNorthing as number;
    const maxEasting = value.maxEasting as number;
    const maxNorthing = value.maxNorthing as number;
    if (minEasting > maxEasting) addError(diagnostics, "INVALID_UTM_EXTENT_ORDER", `${path}/minEasting`, "minEasting must not be greater than maxEasting.");
    if (minNorthing > maxNorthing) addError(diagnostics, "INVALID_UTM_EXTENT_ORDER", `${path}/minNorthing`, "minNorthing must not be greater than maxNorthing.");
    if (minEasting <= 0 || maxEasting >= MAX_EASTING) {
        addWarning(diagnostics, "UTM_EASTING_OUT_OF_RANGE", path, `Eastings are expected strictly between 0 and ${MAX_EASTING} m.`);
    }
    if (minNorthing < 0 || maxNorthing > MAX_NORTHING) {
        addWarning(diagnostics, "UTM_NORTHING_OUT_OF_RANGE", path, `Northings are expected between 0 and ${MAX_NORTHING} m.`);
    }
}

function validateVerticalExtent(value: unknown, path: string, diagnostics: IDiagnostic[]): void {
    if (!isRecord(value)) {
        addError(diagnostics, "INVALID_VERTICAL_EXTENT", path, "Expected a vertical extent object.");
        return;
    }
    validateRootProperties(value, path, diagnostics);
    if (!VERTICAL_REFERENCES.has(value.reference)) {
        addError(diagnostics, "INVALID_VERTICAL_REFERENCE", `${path}/reference`, "Expected ELLIPSOID, GEOID, GROUND or LOCAL.");
    }
    if (!VERTICAL_DIRECTIONS.has(value.direction)) {
        addError(diagnostics, "INVALID_VERTICAL_DIRECTION", `${path}/direction`, "Expected UP or DOWN.");
    }
    const minimumValid = isFiniteNumber(value.minimum);
    const maximumValid = isFiniteNumber(value.maximum);
    if (!minimumValid) addError(diagnostics, "INVALID_VERTICAL_BOUND", `${path}/minimum`, "Expected a finite number of metres.");
    if (!maximumValid) addError(diagnostics, "INVALID_VERTICAL_BOUND", `${path}/maximum`, "Expected a finite number of metres.");
    if (minimumValid && maximumValid && (value.minimum as number) > (value.maximum as number)) {
        addError(diagnostics, "INVALID_VERTICAL_ORDER", path, "minimum must not be greater than maximum.");
    }
    if (value.epsg !== undefined && !isPositiveInteger(value.epsg)) {
        addError(diagnostics, "INVALID_VERTICAL_EPSG", `${path}/epsg`, "Expected a positive integer EPSG code.");
    }
    if (value.groundElevation !== undefined) {
        if (!isFiniteNumber(value.groundElevation)) {
            addError(diagnostics, "INVALID_GROUND_ELEVATION", `${path}/groundElevation`, "Expected a finite number of metres.");
        } else if (value.reference !== "GROUND") {
            addError(diagnostics, "GROUND_ELEVATION_REFERENCE_MISMATCH", `${path}/groundElevation`, "groundElevation is only valid with the GROUND reference.");
        }
    } else if (value.reference === "GROUND") {
        addWarning(diagnostics, "GROUND_ELEVATION_MISSING", path, "Without groundElevation the extent cannot be placed absolutely.");
    }
}

/** Appends diagnostics for a `SPACEXR_bounding_volume_utm` extension object found at `path`. */
export function collectUtmBoundingVolumeDiagnostics(value: unknown, path: string, diagnostics: IDiagnostic[]): void {
    if (!isRecord(value)) {
        addError(diagnostics, "INVALID_UTM_BOUNDING_VOLUME", path, "Expected a UTM bounding volume object.");
        return;
    }
    validateRootProperties(value, path, diagnostics);
    validateUtmProjection(value, path, diagnostics);
    validateUtmExtent(value, path, diagnostics);
    validateVerticalExtent(value.vertical, `${path}/vertical`, diagnostics);
}

/** Validates a standalone `SPACEXR_bounding_volume_utm` extension object. */
export function validateUtmBoundingVolume(value: unknown): IValidationResult<IUtmBoundingVolume> {
    const diagnostics: IDiagnostic[] = [];
    collectUtmBoundingVolumeDiagnostics(value, "", diagnostics);
    const valid = diagnostics.every((diagnostic) => diagnostic.severity !== "error");
    return valid ? { valid: true, diagnostics, value: value as IUtmBoundingVolume } : { valid: false, diagnostics };
}
