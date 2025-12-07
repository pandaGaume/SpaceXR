import { IAsset } from "./asset";
import { IGroupMetadata } from "./group";
import { IMetadataEntity } from "./metadataEntity";
import { IProperties } from "./properties";
import { ISchema } from "./Schema/schema";
import { IStatistics } from "./Statistics/statistics";
import { ITile3d } from "./tile3d";

/**
 * A 3D Tiles tileset.
 */
export interface ITileset {
    asset: IAsset;
    /**
     * @deprecated
     * A dictionary object of metadata about per-feature properties.
     * see EXT_structural_metadata for GLTF 2.0 tilesets.
     */
    properties?: {
        [k: string]: IProperties;
    };
    schema?: ISchema;
    /**
     * The URI (or IRI) of the external schema file. When this is defined, then `schema` shall be undefined.
     */
    schemaUri?: string;
    statistics?: IStatistics;
    /**
     * An array of groups that tile content may belong to. Each element of this array is a metadata entity that describes the group. The tile content `group` property is an index into this array.
     *
     * @minItems 1
     */
    groups?: [IGroupMetadata, ...IGroupMetadata[]];
    metadata?: IMetadataEntity;
    /**
     * The error, in meters, introduced if this tileset is not rendered. At runtime, the geometric error is used to compute screen space error (SSE), i.e., the error measured in pixels.
     */
    geometricError: number;
    root: ITile3d;
    /**
     * Names of 3D Tiles extensions used somewhere in this tileset.
     *
     * @minItems 1
     */
    extensionsUsed?: [string, ...string[]];
    /**
     * Names of 3D Tiles extensions required to properly load this tileset. Each element of this array shall also be contained in `extensionsUsed`.
     *
     * @minItems 1
     */
    extensionsRequired?: [string, ...string[]];
}

export function IsITileset(obj: any): obj is ITileset {
    if (typeof obj !== "object" || obj === null) return false;

    // required
    if (typeof obj.geometricError !== "number") return false;
    if (!obj.asset || typeof obj.asset !== "object") return false;
    if (!obj.root || typeof obj.root !== "object") return false;

    // optional
    if (obj.properties && typeof obj.properties !== "object") return false;
    if (obj.schema && typeof obj.schema !== "object") return false;
    if (obj.schemaUri && typeof obj.schemaUri !== "string") return false;
    if (obj.statistics && typeof obj.statistics !== "object") return false;

    if (obj.groups) {
        if (!Array.isArray(obj.groups) || obj.groups.length < 1) return false;
    }
    if (obj.metadata && typeof obj.metadata !== "object") return false;

    if (obj.extensionsUsed) {
        if (!Array.isArray(obj.extensionsUsed) || obj.extensionsUsed.length < 1) return false;
        if (!obj.extensionsUsed.every((e: any) => typeof e === "string")) return false;
    }
    if (obj.extensionsRequired) {
        if (!Array.isArray(obj.extensionsRequired) || obj.extensionsRequired.length < 1) return false;
        if (!obj.extensionsRequired.every((e: any) => typeof e === "string")) return false;
    }

    return true;
}
