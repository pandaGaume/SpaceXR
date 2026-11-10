import { SPACEXR_BOUNDING_VOLUME_UTM, type IBoundingVolume, type IMetadataEntity, type ITile, type ITileset } from "../model";
import type { IDiagnostic, IValidationResult } from "./diagnostic";
import { addError, isRecord, validateRootProperties, type RecordValue } from "./shared";
import { collectUtmBoundingVolumeDiagnostics } from "./utm-bounding-volume.validator";

/** Bounding volume extensions that can describe a tile extent, with the validator of their extension object. */
const BOUNDING_VOLUME_EXTENSIONS: ReadonlyMap<string, (value: unknown, path: string, diagnostics: IDiagnostic[]) => void> = new Map([
    [SPACEXR_BOUNDING_VOLUME_UTM, collectUtmBoundingVolumeDiagnostics],
]);

/** Occurrence of a bounding volume extension, checked against the tileset extension declarations. */
interface IBoundingVolumeExtensionUse {
    name: string;
    path: string;
    /** True when no box, region or sphere accompanies the extension. */
    standalone: boolean;
}

function validateNonNegativeNumber(value: unknown, path: string, diagnostics: IDiagnostic[]): void {
    if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
        addError(diagnostics, "INVALID_NON_NEGATIVE_NUMBER", path, "Expected a finite number greater than or equal to zero.");
    }
}

function validatePositiveInteger(value: unknown, path: string, diagnostics: IDiagnostic[]): void {
    if (typeof value !== "number" || !Number.isInteger(value) || value < 1) {
        addError(diagnostics, "INVALID_POSITIVE_INTEGER", path, "Expected an integer greater than zero.");
    }
}

function validateNumberTuple(value: unknown, size: number, path: string, diagnostics: IDiagnostic[]): boolean {
    if (!Array.isArray(value) || value.length !== size || value.some((entry) => typeof entry !== "number" || !Number.isFinite(entry))) {
        addError(diagnostics, "INVALID_NUMBER_TUPLE", path, `Expected exactly ${size} finite numbers.`);
        return false;
    }
    return true;
}

function validateBoundingVolume(value: unknown, path: string, diagnostics: IDiagnostic[], extensionUses: IBoundingVolumeExtensionUse[]): value is IBoundingVolume {
    if (!isRecord(value)) {
        addError(diagnostics, "INVALID_BOUNDING_VOLUME", path, "Expected a bounding volume object.");
        return false;
    }

    validateRootProperties(value, path, diagnostics);
    const members = ["box", "region", "sphere"].filter((name) => value[name] !== undefined);
    const extensions = value.extensions;
    const extensionNames = isRecord(extensions) ? [...BOUNDING_VOLUME_EXTENSIONS.keys()].filter((name) => extensions[name] !== undefined) : [];
    if (members.length > 1 || members.length + extensionNames.length === 0) {
        addError(diagnostics, "BOUNDING_VOLUME_CARDINALITY", path, "Exactly one of box, region or sphere is required, unless a bounding volume extension replaces them.");
        return false;
    }

    for (const name of extensionNames) {
        const extensionPath = `${path}/extensions/${name}`;
        BOUNDING_VOLUME_EXTENSIONS.get(name)?.((extensions as RecordValue)[name], extensionPath, diagnostics);
        extensionUses.push({ name, path: extensionPath, standalone: members.length === 0 });
    }

    if (value.box !== undefined) validateNumberTuple(value.box, 12, `${path}/box`, diagnostics);
    if (value.region !== undefined) {
        if (validateNumberTuple(value.region, 6, `${path}/region`, diagnostics)) {
            const region = value.region as number[];
            if (region[1] > region[3]) addError(diagnostics, "INVALID_REGION_LATITUDE_ORDER", `${path}/region`, "South must not be greater than north.");
            if (region[4] > region[5]) addError(diagnostics, "INVALID_REGION_HEIGHT_ORDER", `${path}/region`, "Minimum height must not be greater than maximum height.");
        }
    }
    if (value.sphere !== undefined) {
        if (validateNumberTuple(value.sphere, 4, `${path}/sphere`, diagnostics) && (value.sphere as number[])[3] < 0) {
            addError(diagnostics, "INVALID_SPHERE_RADIUS", `${path}/sphere/3`, "Sphere radius must not be negative.");
        }
    }
    return true;
}

function validateMetadataEntity(value: unknown, path: string, diagnostics: IDiagnostic[]): value is IMetadataEntity {
    if (!isRecord(value)) {
        addError(diagnostics, "INVALID_METADATA_ENTITY", path, "Expected a metadata entity object.");
        return false;
    }
    validateRootProperties(value, path, diagnostics);
    if (typeof value.class !== "string" || value.class.length === 0) {
        addError(diagnostics, "INVALID_METADATA_CLASS", `${path}/class`, "Expected a non-empty metadata class identifier.");
    }
    if (value.properties !== undefined && !isRecord(value.properties)) {
        addError(diagnostics, "INVALID_METADATA_PROPERTIES", `${path}/properties`, "Expected an object keyed by property identifier.");
    }
    return true;
}

function validateContent(value: unknown, path: string, diagnostics: IDiagnostic[], extensionUses: IBoundingVolumeExtensionUse[]): void {
    if (!isRecord(value)) {
        addError(diagnostics, "INVALID_CONTENT", path, "Expected a content object.");
        return;
    }
    validateRootProperties(value, path, diagnostics);
    if (typeof value.uri !== "string" || value.uri.length === 0) {
        addError(diagnostics, "INVALID_CONTENT_URI", `${path}/uri`, "Expected a non-empty content URI.");
    }
    if (value.boundingVolume !== undefined) validateBoundingVolume(value.boundingVolume, `${path}/boundingVolume`, diagnostics, extensionUses);
    if (value.metadata !== undefined) validateMetadataEntity(value.metadata, `${path}/metadata`, diagnostics);
    if (value.group !== undefined && (!Number.isInteger(value.group) || (value.group as number) < 0)) {
        addError(diagnostics, "INVALID_CONTENT_GROUP", `${path}/group`, "Expected a non-negative integer group index.");
    }
}

function validateImplicitTiling(value: unknown, path: string, diagnostics: IDiagnostic[]): void {
    if (!isRecord(value)) {
        addError(diagnostics, "INVALID_IMPLICIT_TILING", path, "Expected an implicit tiling object.");
        return;
    }
    validateRootProperties(value, path, diagnostics);
    if (value.subdivisionScheme !== "QUADTREE" && value.subdivisionScheme !== "OCTREE") {
        addError(diagnostics, "INVALID_SUBDIVISION_SCHEME", `${path}/subdivisionScheme`, "Expected QUADTREE or OCTREE.");
    }
    validatePositiveInteger(value.subtreeLevels, `${path}/subtreeLevels`, diagnostics);
    validatePositiveInteger(value.availableLevels, `${path}/availableLevels`, diagnostics);
    if (!isRecord(value.subtrees) || typeof value.subtrees.uri !== "string" || value.subtrees.uri.length === 0) {
        addError(diagnostics, "INVALID_SUBTREE_URI", `${path}/subtrees/uri`, "Expected a non-empty subtree URI template.");
    }
}

function validateImplicitTemplate(uri: unknown, scheme: unknown, path: string, diagnostics: IDiagnostic[]): void {
    if (typeof uri !== "string") return;
    for (const variable of scheme === "OCTREE" ? ["{level}", "{x}", "{y}", "{z}"] : ["{level}", "{x}", "{y}"]) {
        if (!uri.includes(variable)) {
            addError(diagnostics, "INVALID_IMPLICIT_TEMPLATE", path, `Implicit template URI must contain ${variable}.`);
        }
    }
}

function validateTile(value: unknown, path: string, diagnostics: IDiagnostic[], extensionUses: IBoundingVolumeExtensionUse[], root: boolean): value is ITile {
    if (!isRecord(value)) {
        addError(diagnostics, "INVALID_TILE", path, "Expected a tile object.");
        return false;
    }
    validateRootProperties(value, path, diagnostics);
    validateBoundingVolume(value.boundingVolume, `${path}/boundingVolume`, diagnostics, extensionUses);
    if (value.viewerRequestVolume !== undefined) validateBoundingVolume(value.viewerRequestVolume, `${path}/viewerRequestVolume`, diagnostics, extensionUses);
    validateNonNegativeNumber(value.geometricError, `${path}/geometricError`, diagnostics);

    if (root && value.refine === undefined) {
        addError(diagnostics, "MISSING_ROOT_REFINEMENT", `${path}/refine`, "The root tile must declare ADD or REPLACE refinement.");
    } else if (value.refine !== undefined && value.refine !== "ADD" && value.refine !== "REPLACE") {
        addError(diagnostics, "INVALID_REFINEMENT", `${path}/refine`, "Expected ADD or REPLACE.");
    }

    if (value.transform !== undefined) validateNumberTuple(value.transform, 16, `${path}/transform`, diagnostics);
    if (value.content !== undefined && value.contents !== undefined) {
        addError(diagnostics, "CONTENT_CARDINALITY", path, "content and contents are mutually exclusive.");
    }
    if (value.content !== undefined) validateContent(value.content, `${path}/content`, diagnostics, extensionUses);
    if (value.contents !== undefined) {
        if (!Array.isArray(value.contents) || value.contents.length === 0) {
            addError(diagnostics, "INVALID_CONTENTS", `${path}/contents`, "Expected a non-empty content array.");
        } else {
            value.contents.forEach((content, index) => validateContent(content, `${path}/contents/${index}`, diagnostics, extensionUses));
        }
    }
    if (value.metadata !== undefined) validateMetadataEntity(value.metadata, `${path}/metadata`, diagnostics);
    if (value.implicitTiling !== undefined) {
        validateImplicitTiling(value.implicitTiling, `${path}/implicitTiling`, diagnostics);
        const implicit = isRecord(value.implicitTiling) ? value.implicitTiling : undefined;
        if (value.children !== undefined) {
            addError(diagnostics, "IMPLICIT_CHILDREN_FORBIDDEN", `${path}/children`, "An implicit root tile must omit children.");
        }
        if (value.metadata !== undefined) {
            addError(diagnostics, "IMPLICIT_METADATA_FORBIDDEN", `${path}/metadata`, "An implicit root tile must omit inline tile metadata.");
        }
        if (isRecord(value.boundingVolume) && value.boundingVolume.sphere !== undefined) {
            addError(diagnostics, "IMPLICIT_SPHERE_FORBIDDEN", `${path}/boundingVolume/sphere`, "Implicit tiling cannot subdivide a sphere.");
        }
        const contents = value.contents ?? (value.content === undefined ? [] : [value.content]);
        if (Array.isArray(contents)) {
            contents.forEach((content, index) => {
                if (!isRecord(content)) return;
                const contentPath = value.contents === undefined ? `${path}/content` : `${path}/contents/${index}`;
                if (content.boundingVolume !== undefined) {
                    addError(diagnostics, "IMPLICIT_CONTENT_BOUNDING_VOLUME_FORBIDDEN", `${contentPath}/boundingVolume`, "Implicit content templates must omit boundingVolume.");
                }
                validateImplicitTemplate(content.uri, implicit?.subdivisionScheme, `${contentPath}/uri`, diagnostics);
            });
        }
        if (implicit && isRecord(implicit.subtrees)) {
            validateImplicitTemplate(implicit.subtrees.uri, implicit.subdivisionScheme, `${path}/implicitTiling/subtrees/uri`, diagnostics);
        }
    }
    if (value.children !== undefined) {
        if (!Array.isArray(value.children) || value.children.length === 0) {
            addError(diagnostics, "INVALID_CHILDREN", `${path}/children`, "Expected a non-empty child tile array.");
        } else {
            value.children.forEach((child, index) => validateTile(child, `${path}/children/${index}`, diagnostics, extensionUses, false));
        }
    }
    return true;
}

function validateStringArray(value: unknown, path: string, diagnostics: IDiagnostic[]): string[] | undefined {
    if (value === undefined) return undefined;
    if (!Array.isArray(value) || value.length === 0 || value.some((entry) => typeof entry !== "string" || entry.length === 0)) {
        addError(diagnostics, "INVALID_STRING_ARRAY", path, "Expected a non-empty array of non-empty strings.");
        return undefined;
    }
    return value as string[];
}

/** Reports each bounding volume extension once, at its first occurrence. */
function validateBoundingVolumeExtensionDeclarations(
    extensionUses: readonly IBoundingVolumeExtensionUse[],
    used: ReadonlySet<string>,
    required: ReadonlySet<string>,
    diagnostics: IDiagnostic[]
): void {
    const reported = new Set<string>();
    for (const use of extensionUses) {
        if (reported.has(use.name)) continue;
        if (!used.has(use.name)) {
            addError(diagnostics, "EXTENSION_NOT_DECLARED", use.path, `Extension ${use.name} is missing from extensionsUsed.`);
            reported.add(use.name);
        } else if (use.standalone && !required.has(use.name)) {
            addError(
                diagnostics,
                "BOUNDING_VOLUME_EXTENSION_NOT_REQUIRED",
                use.path,
                `Extension ${use.name} replaces the standard bounding volume and must be listed in extensionsRequired.`
            );
            reported.add(use.name);
        }
    }
}

export function validateTileset(value: unknown): IValidationResult<ITileset> {
    const diagnostics: IDiagnostic[] = [];
    if (!isRecord(value)) {
        addError(diagnostics, "INVALID_TILESET", "", "Expected a tileset object.");
        return { valid: false, diagnostics };
    }

    validateRootProperties(value, "", diagnostics);
    if (!isRecord(value.asset)) {
        addError(diagnostics, "INVALID_ASSET", "/asset", "Expected an asset object.");
    } else {
        validateRootProperties(value.asset, "/asset", diagnostics);
        if (typeof value.asset.version !== "string" || value.asset.version.length === 0) {
            addError(diagnostics, "INVALID_ASSET_VERSION", "/asset/version", "Expected a non-empty 3D Tiles version.");
        }
        if (value.asset.tilesetVersion !== undefined && typeof value.asset.tilesetVersion !== "string") {
            addError(diagnostics, "INVALID_TILESET_VERSION", "/asset/tilesetVersion", "Expected a string tileset version.");
        }
    }

    validateNonNegativeNumber(value.geometricError, "/geometricError", diagnostics);
    const extensionUses: IBoundingVolumeExtensionUse[] = [];
    validateTile(value.root, "/root", diagnostics, extensionUses, true);

    if (value.schema !== undefined && value.schemaUri !== undefined) {
        addError(diagnostics, "SCHEMA_CARDINALITY", "", "schema and schemaUri are mutually exclusive.");
    }
    if (value.schema !== undefined && !isRecord(value.schema)) {
        addError(diagnostics, "INVALID_SCHEMA", "/schema", "Expected an embedded metadata schema object.");
    }
    if (value.schemaUri !== undefined && (typeof value.schemaUri !== "string" || value.schemaUri.length === 0)) {
        addError(diagnostics, "INVALID_SCHEMA_URI", "/schemaUri", "Expected a non-empty schema URI.");
    }
    if (value.metadata !== undefined) validateMetadataEntity(value.metadata, "/metadata", diagnostics);
    if (value.groups !== undefined && (!Array.isArray(value.groups) || value.groups.length === 0)) {
        addError(diagnostics, "INVALID_GROUPS", "/groups", "Expected a non-empty group metadata array.");
    }

    const used = validateStringArray(value.extensionsUsed, "/extensionsUsed", diagnostics);
    const required = validateStringArray(value.extensionsRequired, "/extensionsRequired", diagnostics);
    const usedSet = new Set(used ?? []);
    const requiredSet = new Set(required ?? []);
    validateBoundingVolumeExtensionDeclarations(extensionUses, usedSet, requiredSet, diagnostics);
    if (required) {
        required.forEach((extension, index) => {
            if (!usedSet.has(extension)) {
                addError(diagnostics, "REQUIRED_EXTENSION_NOT_USED", `/extensionsRequired/${index}`, `Required extension ${extension} is missing from extensionsUsed.`);
            }
        });
    }

    const valid = diagnostics.every((diagnostic) => diagnostic.severity !== "error");
    return valid ? { valid: true, diagnostics, value: value as ITileset } : { valid: false, diagnostics };
}
