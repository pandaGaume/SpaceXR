import { IAsset } from "./asset";
import { IGroupMetadata } from "./group";
import { IMetadataEntity } from "./metadataEntity";
import { IProperties } from "./properties";
import { ISchema } from "./Schema/schema";
import { IStatistics } from "./Statistics/statistics";
import { ITile } from "./tile";

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
    root: ITile;
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
