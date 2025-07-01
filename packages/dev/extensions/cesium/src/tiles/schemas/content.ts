import { IBoundingVolume } from "./boundingVolume";
import { IMetadataEntity } from "./metadataEntity";

/**
 * Metadata about the tile's content and a link to the content.
 */
export interface IContent {
    boundingVolume?: IBoundingVolume;
    /**
     * A uri that points to tile content. When the uri is relative, it is relative to the referring tileset JSON file.
     */
    uri: string;
    metadata?: IMetadataEntity;
    /**
     * The group this content belongs to. The value is an index into the array of `groups` that is defined for the containing tileset.
     */
    group?: number;
    [k: string]: unknown;
}
